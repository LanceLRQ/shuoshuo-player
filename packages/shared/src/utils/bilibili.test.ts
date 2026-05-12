import {
  bilibiliThumbUrl,
  formatNumber10K,
  getBilibiliMidByURL,
  pickVideosFields,
  urlPrefixFixed,
} from './bilibili';

describe('A4: getBilibiliMidByURL', () => {
  it('纯数字 UID 直接返回', () => {
    expect(getBilibiliMidByURL('283886865')).toBe('283886865');
  });

  it('从 space.bilibili.com URL 提取 UID', () => {
    expect(getBilibiliMidByURL('https://space.bilibili.com/123456')).toBe('123456');
  });

  it('从 URL 末尾带 / 的形式提取', () => {
    expect(getBilibiliMidByURL('https://space.bilibili.com/123456/')).toBe('123456');
  });

  it('非法输入返回空字符串', () => {
    expect(getBilibiliMidByURL('https://example.com/foo')).toBe('');
    expect(getBilibiliMidByURL('')).toBe('');
    expect(getBilibiliMidByURL('abc')).toBe('');
  });
});

describe('A4: formatNumber10K', () => {
  it('< 10000 直接转字符串', () => {
    expect(formatNumber10K(0)).toBe('0');
    expect(formatNumber10K(9999)).toBe('9999');
  });

  it('>= 10000 显示为 X.X 万', () => {
    expect(formatNumber10K(10000)).toBe('1.0万');
    expect(formatNumber10K(15234)).toBe('1.5万');
    expect(formatNumber10K(99999)).toBe('10.0万');
  });
});

describe('A4: urlPrefixFixed', () => {
  it('// 开头补 https', () => {
    expect(urlPrefixFixed('//i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('http:// 替换为 https://', () => {
    expect(urlPrefixFixed('http://i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('已是 https:// 保持不变', () => {
    expect(urlPrefixFixed('https://i0.hdslb.com/x.png')).toBe('https://i0.hdslb.com/x.png');
  });

  it('空值返回空字符串', () => {
    expect(urlPrefixFixed('')).toBe('');
    expect(urlPrefixFixed(undefined as unknown as string)).toBe('');
    expect(urlPrefixFixed(null as unknown as string)).toBe('');
  });
});

describe('A4: bilibiliThumbUrl', () => {
  it('hdslb 域名追加 @{w}w_{h}h_1c.webp 后缀', () => {
    expect(bilibiliThumbUrl('https://i0.hdslb.com/bfs/archive/x.jpg', 200, 125)).toBe(
      'https://i0.hdslb.com/bfs/archive/x.jpg@200w_125h_1c.webp',
    );
  });

  it('// 协议自动 fixed 后再追加', () => {
    expect(bilibiliThumbUrl('//i0.hdslb.com/bfs/archive/x.jpg', 200, 125)).toBe(
      'https://i0.hdslb.com/bfs/archive/x.jpg@200w_125h_1c.webp',
    );
  });

  it('http 协议 fixed 为 https 再追加', () => {
    expect(bilibiliThumbUrl('http://i0.hdslb.com/bfs/face/y.png', 96, 96)).toBe(
      'https://i0.hdslb.com/bfs/face/y.png@96w_96h_1c.webp',
    );
  });

  it('已含 @ 后缀的 URL 不重复追加（避免双重处理）', () => {
    expect(bilibiliThumbUrl('https://i0.hdslb.com/bfs/x.jpg@100w_60h.webp', 200, 125)).toBe(
      'https://i0.hdslb.com/bfs/x.jpg@100w_60h.webp',
    );
  });

  it('非 B 站域名原样返回（不污染外站资源）', () => {
    expect(bilibiliThumbUrl('https://example.com/x.jpg', 200, 125)).toBe(
      'https://example.com/x.jpg',
    );
  });

  it('空字符串返回空（让上层走 fallback）', () => {
    expect(bilibiliThumbUrl('', 200, 125)).toBe('');
  });

  it('biliimg 域名也命中规则', () => {
    expect(bilibiliThumbUrl('https://biliimg.com/foo.png', 64, 64)).toBe(
      'https://biliimg.com/foo.png@64w_64h_1c.webp',
    );
  });
});

describe('A4: pickVideosFields(view) 映射 pages/videos', () => {
  const baseViewItem = {
    bvid: 'BV1aB4y1k7Yx',
    aid: 12345,
    pic: 'https://x.com/p.jpg',
    title: 't',
    sub_title: '',
    is_union_video: false,
    ctime: 100,
    duration: '3:00',
    stat: { view: 9, reply: 1 },
    owner: { name: 'up', mid: 7 },
    desc: 'd',
    cid: 99,
  };

  it('单 P 投稿：videos=1, pages 长度 1', () => {
    const mapped = pickVideosFields(
      {
        ...baseViewItem,
        videos: 1,
        pages: [{ cid: 99, page: 1, part: '', duration: 180 }],
      } as never,
      'view',
    );
    expect(mapped[0]?.videos).toBe(1);
    expect(mapped[0]?.pages).toEqual([{ cid: 99, page: 1, part: '', duration: 180 }]);
  });

  it('多 P 投稿：videos=N, pages 完整映射', () => {
    const mapped = pickVideosFields(
      {
        ...baseViewItem,
        videos: 3,
        pages: [
          { cid: 100, page: 1, part: 'Intro', duration: 60 },
          { cid: 101, page: 2, part: 'Verse', duration: 90 },
          { cid: 102, page: 3, part: 'Outro', duration: 30 },
        ],
      } as never,
      'view',
    );
    expect(mapped[0]?.videos).toBe(3);
    expect(mapped[0]?.pages).toHaveLength(3);
    expect(mapped[0]?.pages?.[1]).toEqual({ cid: 101, page: 2, part: 'Verse', duration: 90 });
  });

  it('pages 缺失 → pages 字段为 undefined', () => {
    const mapped = pickVideosFields({ ...baseViewItem }, 'view');
    expect(mapped[0]?.pages).toBeUndefined();
  });

  it('pages[] 中非法项被过滤（缺 cid 或非数字 page）', () => {
    const mapped = pickVideosFields(
      {
        ...baseViewItem,
        videos: 2,
        pages: [
          { cid: 100, page: 1, part: 'ok', duration: 60 },
          { page: 2, part: 'no-cid', duration: 30 },
          { cid: 102, page: 'three' as never, part: 'bad-page', duration: 30 },
          null,
        ],
      } as never,
      'view',
    );
    expect(mapped[0]?.pages).toEqual([{ cid: 100, page: 1, part: 'ok', duration: 60 }]);
  });

  it('default 模式不触发 view 映射（不动 pages 字段）', () => {
    const mapped = pickVideosFields(
      { bvid: 'BV1', videos: 99, pages: [{ cid: 1, page: 1, part: '', duration: 0 }] } as never,
      'default',
    );
    // default 模式直接透传，无映射规则；pages 透传不动
    expect((mapped[0] as { videos?: number }).videos).toBe(99);
  });
});
