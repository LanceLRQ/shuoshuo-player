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