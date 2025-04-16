import dayjs from "dayjs";

export const TimeStampNow = () => {
    return Math.round(Date.now() / 1000)
}

export function formatMillisecond(ms) {
    const minute = Math.floor(ms / 1000 / 60);
    const second = Math.floor(ms / 1000) % 60;
    const millisecond = ms % 1000;
    return `${minute.toString().padStart(2, '0')}:${second
        .toString()
        .padStart(2, '0')}.${millisecond.toString().padStart(3, '0')}`;
}

export function formatTimeLyric(d) {
    const ms = d * 1000;
    const minute = Math.floor(ms / 1000 / 60);
    const second = Math.floor(ms / 1000) % 60;
    const millisecond = ms % 1000;
    return `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}.${(millisecond / 10).toFixed(0).padStart(2, '0')}`;
}

export function formatTimeStampFromServer(d) {
    return dayjs(d * 1000).format('YYYY-MM-DD HH:mm:ss');
}

export function removeEmptyLRCItem(lrcText) {
    return String(lrcText || '').split('\n').filter(item => !/^\[(.+)]\s*$/.test(item)).join('\n')
}

export function createLyricsFinder(lyricsArray, offset = 0) {
    // lyricsArray需要预处理，确保数组按timestamp升序排列
    const sortedLyrics = [...lyricsArray].sort((a, b) => a.timestamp - b.timestamp);
    return function(_currentTime) {
        let currentTime = _currentTime + offset;
        let left = 0;
        let right = sortedLyrics.length - 1;
        let result = -1;

        // 二分查找
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (sortedLyrics[mid].timestamp <= currentTime) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return {
            value: sortedLyrics[result],
            index: result
        };
    };
}

export function objectToDownload(data, filename = 'export.json') {
    // 将JSON对象转换为字符串
    const jsonString = JSON.stringify(data, null, 2); // 第三个参数用于美化输出

    // 创建Blob对象
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    // 触发点击下载
    document.body.appendChild(a);
    a.click();

    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function createJsonFileLoader(callback, errorCallback) {
    // 创建隐藏的文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    // 添加到DOM（虽然隐藏但仍需在DOM中）
    document.body.appendChild(fileInput);

    // 监听文件选择变化
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            const err = new Error('请选择有效的JSON文件');
            if (errorCallback) errorCallback(err);
            return;
        }

        // 创建文件阅读器
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                if (callback) callback(jsonData, file.name);
            } catch (parseError) {
                const err = new Error('解析JSON失败: ' + parseError.message);
                if (errorCallback) errorCallback(err);
            }
        };

        reader.onerror = function() {
            const err = new Error('读取文件时发生错误');
            if (errorCallback) errorCallback(err);
        };

        reader.readAsText(file);

        // 清理：移除文件输入元素
        setTimeout(() => {
            document.body.removeChild(fileInput);
        }, 100);
    });

    // 触发文件选择对话框
    fileInput.click();
}

/*** 检查云用户权限 ***/
export const CheckCloudUserPermission = function (account, roleRequire) {
    if (!account?.role) {
        return false;
    }
    return (account.role & roleRequire) !== 0;
}

export function createLyricFileLoader(callback, errorCallback) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.lrc';
    fileInput.style.display = 'none';

    document.body.appendChild(fileInput);

    // 监听文件选择变化
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.name.endsWith('.lrc')) {
            const err = new Error('请选择有效的歌词文件');
            if (errorCallback) errorCallback(err);
            return;
        }

        // 创建文件阅读器
        const reader = new FileReader();

        reader.onload = function(e) {
            if (callback) callback(e.target.result, file.name);
        };

        reader.onerror = function() {
            const err = new Error('读取文件时发生错误');
            if (errorCallback) errorCallback(err);
        };

        reader.readAsText(file);

        // 清理：移除文件输入元素
        setTimeout(() => {
            document.body.removeChild(fileInput);
        }, 100);
    });

    // 触发文件选择对话框
    fileInput.click();
}

export function textToDownload(data, filename = 'export.txt') {
    // 创建Blob对象
    const blob = new Blob([data], { type: 'plain/text' });

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    // 触发点击下载
    document.body.appendChild(a);
    a.click();

    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 过滤掉字符串中非法的 Windows 文件名字符
 * @param {string} input 原始字符串
 * @param {string} [replacement=''] 替换非法字符的字符串，默认为空字符串
 * @returns {string} 过滤后的合法文件名
 */
export function filterInvalidFileNameChars(input, replacement = '') {
    if (typeof input !== 'string') {
        return '';
    }

    // Windows 文件名非法字符
    const illegalChars = /[\\/:*?"<>|]/g;

    // 替换非法字符
    return input.replace(illegalChars, replacement);
}
