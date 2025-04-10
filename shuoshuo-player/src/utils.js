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
        let result = null;

        // 二分查找
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (sortedLyrics[mid].timestamp <= currentTime) {
                result = sortedLyrics[mid];
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return result;
    };
}