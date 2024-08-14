// 格式化数字（单位：万）
export const formatNumber10K = (number) => {
    if (number > 10000) {
        return (number / 10000).toFixed(1).replace('.0', '') + '万';
    }
    return number;
}