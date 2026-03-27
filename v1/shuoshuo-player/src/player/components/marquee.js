import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";

const Marquee = ({ text, speed = 1 }) => {
    const marqueeRef = useRef(null); // 用于引用容器
    const spanRef = useRef(null); // 用于引用文本内容

    useEffect(() => {
        const marquee = marqueeRef.current;
        const span = spanRef.current;
        const containerWidth = marquee.offsetWidth; // 容器宽度
        const spanWidth = span.offsetWidth; // 文本宽度
        // 如果文本宽度小于或等于容器宽度，则不启动动画
        if (spanWidth <= containerWidth) {
            return;
        }
        let position = containerWidth; // 初始位置在右侧外
        const animate = () => {
            position -= speed; // 每次移动的像素值由 speed 控制
            if (position < -spanWidth) {
                position = containerWidth; // 如果完全移出左侧，重置到右侧
            }
            span.style.transform = `translateX(${position}px)`; // 移动文本
            requestAnimationFrame(animate); // 递归调用实现动画
        };
        const animationFrame = requestAnimationFrame(animate); // 启动动画
        return () => {
            cancelAnimationFrame(animationFrame); // 组件卸载时停止动画
        };
    }, [text, speed]); // 依赖项包括 text 和 speed

    return (
        <Box
            ref={marqueeRef}
            sx={{
                width: "100%",
                overflow: "hidden",
                whiteSpace: "nowrap",
                position: "relative",
                height: "24px", // 根据需要调整高度
            }}
        >
            <Box
                ref={spanRef}
                component="span"
                sx={{
                    display: "inline-block",
                    position: "absolute",
                    whiteSpace: "nowrap",
                }}
            >
                {text}
            </Box>
        </Box>
    );
};

export default Marquee;
