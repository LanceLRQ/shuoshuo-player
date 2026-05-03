// QQ 音乐歌词爬虫命令
//
// 关键不变量（与 v1 client/spider.js 行为对齐）：
// 1. search 走 POST https://u.y.qq.com/cgi-bin/musicu.fcg，body 为 SearchCgiService 协议 JSON
// 2. getLRC 走 GET https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg?songmid=...
//    响应是 JSONP（MusicJsonCallback({...})），需剥离包装再 Base64 解码 lyric 字段
// 3. Headers 必须设置 Referer/Origin 为 https://y.qq.com，否则触发反爬

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Singer {
    pub name: String,
    pub mid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Album {
    pub name: String,
    pub mid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QQMusicSong {
    pub mid: String,
    pub name: String,
    pub singer: Vec<Singer>,
    pub album: Album,
}

const SEARCH_URL: &str = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const LRC_URL: &str = "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg";

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn build_search_payload(keyword: &str, limit: u32) -> Value {
    json!({
        "comm": {
            "_channelid": "0",
            "_os_version": "6.1.7601-2%2C+Service+Pack+1",
            "authst": "",
            "ct": "19",
            "cv": "1873",
            "guid": "",
            "patch": "118",
            "psrf_access_token_expiresAt": 0,
            "psrf_qqaccess_token": "",
            "psrf_qqopenid": "",
            "psrf_qqunionid": "",
            "tmeAppID": "qqmusic",
            "tmeLoginType": 2,
            "uin": "0",
            "wid": "0"
        },
        "music.search.SearchCgiService": {
            "method": "DoSearchForQQMusicDesktop",
            "module": "music.search.SearchCgiService",
            "param": {
                "grp": 1,
                "num_per_page": limit,
                "page_num": 1,
                "query": keyword,
                "remoteplace": "txt.newclient.top",
                "search_type": 0,
                "searchid": ""
            }
        }
    })
}

/// 从 JSONP 响应字符串中提取并 Base64 解码 lyric 字段
///
/// 抽出为独立函数便于 cargo test 单测（无需起 HTTP 服务）。
pub fn parse_lrc_jsonp(text: &str) -> Result<String, String> {
    // (?s) 让 . 匹配换行；非贪婪避免吃掉错误位置的 ')'
    let re = Regex::new(r"(?s)MusicJsonCallback\((.*)\)").map_err(|e| e.to_string())?;
    let json_str = re
        .captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str())
        .ok_or("Failed to parse JSONP response")?;

    let data: Value = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    let lyric_base64 = data["lyric"].as_str().ok_or("No lyric field in response")?;

    let bytes = BASE64.decode(lyric_base64).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

/// 搜索 QQ 音乐
#[tauri::command]
pub async fn qqmusic_search(
    keyword: String,
    limit: Option<u32>,
) -> Result<Vec<QQMusicSong>, String> {
    let limit = limit.unwrap_or(10);
    let client = Client::new();
    let payload = build_search_payload(&keyword, limit);

    let resp = client
        .post(SEARCH_URL)
        .header("Host", "u.y.qq.com")
        .header("Content-Type", "application/json")
        .header("Referer", "https://y.qq.com/n/ryqq/player")
        .header("Origin", "https://y.qq.com")
        .query(&[("pcachetime", now_millis().to_string())])
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;

    let songs = data["music.search.SearchCgiService"]["data"]["body"]["song"]["list"]
        .as_array()
        .ok_or("Failed to parse search results")?;

    Ok(songs
        .iter()
        .filter_map(|s| serde_json::from_value(s.clone()).ok())
        .collect())
}

/// 获取 QQ 音乐歌词
#[tauri::command]
pub async fn qqmusic_get_lrc(mid: String) -> Result<String, String> {
    let client = Client::new();
    let resp = client
        .get(LRC_URL)
        .header("Origin", "https://y.qq.com/")
        .header("Referer", "https://y.qq.com/")
        .query(&[("songmid", &mid)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    parse_lrc_jsonp(&text)
}

#[cfg(test)]
mod tests {
    use super::{build_search_payload, parse_lrc_jsonp};
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

    #[test]
    fn build_search_payload_includes_query_and_limit() {
        let payload = build_search_payload("hello", 25);
        assert_eq!(
            payload["music.search.SearchCgiService"]["param"]["query"],
            "hello"
        );
        assert_eq!(
            payload["music.search.SearchCgiService"]["param"]["num_per_page"],
            25
        );
    }

    #[test]
    fn parse_lrc_jsonp_decodes_base64_lyric() {
        let original = "[00:00.00]Hello World\n[00:01.00]Test";
        let encoded = BASE64.encode(original);
        let jsonp = format!(
            "MusicJsonCallback({{\"lyric\":\"{}\",\"trans\":\"\"}})",
            encoded
        );
        let result = parse_lrc_jsonp(&jsonp).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn parse_lrc_jsonp_handles_multiline_response() {
        let original = "abc";
        let encoded = BASE64.encode(original);
        let jsonp = format!(
            "MusicJsonCallback(\n{{\"lyric\":\"{}\"}}\n)",
            encoded
        );
        let result = parse_lrc_jsonp(&jsonp).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn parse_lrc_jsonp_rejects_missing_wrapper() {
        let result = parse_lrc_jsonp("invalid response");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("JSONP"));
    }

    #[test]
    fn parse_lrc_jsonp_rejects_missing_lyric_field() {
        let jsonp = r#"MusicJsonCallback({"trans":"some translation"})"#;
        let result = parse_lrc_jsonp(jsonp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("lyric"));
    }

    #[test]
    fn parse_lrc_jsonp_rejects_invalid_base64() {
        let jsonp = r#"MusicJsonCallback({"lyric":"%%%not-base64%%%"})"#;
        let result = parse_lrc_jsonp(jsonp);
        assert!(result.is_err());
    }
}
