/**
 * PriceChart Component
 * 价格图表组件（简化版）
 */
import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

const ChartWrapper = styled.div`
    width: 100%;
    height: 350px;
    position: relative;
`;

const ChartCanvas = styled.canvas`
    width: 100%;
    height: 100%;
`;

const IntervalSelector = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
`;

const IntervalButton = styled.button`
    padding: 6px 12px;
    border: 1px solid ${props => props.active ? '#00d9ff' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 6px;
    background: ${props => props.active ? 'rgba(0, 217, 255, 0.1)' : 'transparent'};
    color: ${props => props.active ? '#00d9ff' : '#888'};
    cursor: pointer;
    font-size: 12px;
    
    &:hover {
        border-color: #00d9ff;
    }
`;

const NoData = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #555;
    font-size: 14px;
`;

const PriceTooltip = styled.div`
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: #fff;
    pointer-events: none;
    display: ${props => props.visible ? 'block' : 'none'};
    z-index: 100;
`;

function PriceChart({ data }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    
    const [interval, setInterval] = useState('1m');
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
    
    // 绘制图表
    useEffect(() => {
        if (!data || data.length === 0 || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        // 设置画布尺寸
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = rect.width;
        const height = rect.height;
        const padding = { top: 20, right: 60, bottom: 30, left: 10 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // 清空画布
        ctx.clearRect(0, 0, width, height);
        
        // 找到价格范围
        const prices = data.map(d => d.close);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        // 绘制网格线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // 横向网格
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            // 价格标签
            const price = maxPrice - (priceRange / 4) * i;
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(price.toFixed(4), width - padding.right + 5, y + 4);
        }
        
        // 绘制价格线
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const xStep = chartWidth / (data.length - 1 || 1);
        
        data.forEach((point, i) => {
            const x = padding.left + i * xStep;
            const y = padding.top + chartHeight - ((point.close - minPrice) / priceRange) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // 绘制面积填充
        const lastPoint = data[data.length - 1];
        const lastX = padding.left + (data.length - 1) * xStep;
        const lastY = padding.top + chartHeight - ((lastPoint.close - minPrice) / priceRange) * chartHeight;
        
        ctx.lineTo(lastX, height - padding.bottom);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 217, 255, 0.0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 绘制最新价格点
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
        
    }, [data, interval]);
    
    // 鼠标移动事件
    const handleMouseMove = (e) => {
        if (!data || data.length === 0) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 10, right: 60 };
        const chartWidth = rect.width - padding.left - padding.right;
        
        const index = Math.floor((x - padding.left) / chartWidth * data.length);
        
        if (index >= 0 && index < data.length) {
            const point = data[index];
            setTooltip({
                visible: true,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                data: point
            });
        }
    };
    
    const handleMouseLeave = () => {
        setTooltip({ ...tooltip, visible: false });
    };
    
    if (!data || data.length === 0) {
        return (
            <ChartWrapper ref={containerRef}>
                <NoData>No price history available</NoData>
            </ChartWrapper>
        );
    }
    
    return (
        <div>
            <IntervalSelector>
                <IntervalButton active={interval === '1m'} onClick={() => setInterval('1m')}>1m</IntervalButton>
                <IntervalButton active={interval === '5m'} onClick={() => setInterval('5m')}>5m</IntervalButton>
                <IntervalButton active={interval === '1h'} onClick={() => setInterval('1h')}>1h</IntervalButton>
                <IntervalButton active={interval === '1d'} onClick={() => setInterval('1d')}>1d</IntervalButton>
            </IntervalSelector>
            
            <ChartWrapper ref={containerRef}>
                <ChartCanvas 
                    ref={canvasRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                />
                <PriceTooltip 
                    visible={tooltip.visible}
                    style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
                >
                    {tooltip.data && (
                        <>
                            <div>Time: {new Date(tooltip.data.time * 1000).toLocaleString()}</div>
                            <div>Price: {tooltip.data.close?.toFixed(6)}</div>
                        </>
                    )}
                </PriceTooltip>
            </ChartWrapper>
        </div>
    );
}

export default PriceChart;
