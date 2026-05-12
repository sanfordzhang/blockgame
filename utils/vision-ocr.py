#!/usr/bin/env python3
"""
使用 Vision 框架进行 OCR，识别截图中的按钮位置
"""
import sys
import json
import subprocess

def ocr_screenshot(image_path, keywords=None):
    """使用 Vision 框架识别图片中的文本和位置"""
    
    if keywords is None:
        keywords = ['deposit', '充值', 'sign', '签名', 'confirm', '确认', 'submit', '提交']
    
    script = f'''
import Vision
import Quartz
from Foundation import NSURL

# 加载图片
image_url = NSURL.fileURLWithPath_("{image_path}")
image = Quartz.CGImageSourceCreateImageAtIndex(Quartz.CGImageSourceCreateWithURL(image_url, None), 0, None)

if image is None:
    print("{{'error': 'Failed to load image'}}")
else:
    # 创建 OCR 请求
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    
    # 执行请求
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(image, {{}})
    success = handler.performRequests_error_([request], None)
    
    if success:
        results = []
        for observation in request.results():
            candidates = observation.topCandidates_(1)
            if candidates:
                text = candidates[0].string()
                bbox = observation.boundingBox()
                
                # 转换坐标（Vision 使用左下角为原点）
                # 屏幕逻辑分辨率
                screen_width = 1512
                screen_height = 982
                
                # bbox 是归一化坐标 (0-1)
                x = bbox.origin.x * screen_width + bbox.size.width * screen_width / 2
                y = (1 - bbox.origin.y - bbox.size.height) * screen_height + bbox.size.height * screen_height / 2
                
                results.append({{
                    'text': text,
                    'x': int(x),
                    'y': int(y),
                    'width': int(bbox.size.width * screen_width),
                    'height': int(bbox.size.height * screen_height)
                }})
        
        print(json.dumps(results))
    else:
        print("{{'error': 'OCR failed'}}")
'''
    
    try:
        result = subprocess.run(
            ['python3', '-c', script],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                # 如果 JSON 解析失败，返回原始输出
                return {'raw': result.stdout}
        else:
            return {'error': result.stderr}
            
    except Exception as e:
        return {'error': str(e)}


def find_button_position(image_path, button_text):
    """查找特定按钮的位置"""
    results = ocr_screenshot(image_path)
    
    if isinstance(results, list):
        for item in results:
            if isinstance(item, dict) and 'text' in item:
                if button_text.lower() in item['text'].lower():
                    return item
    
    return None


def find_all_buttons(image_path, keywords):
    """查找所有包含关键词的按钮"""
    results = ocr_screenshot(image_path)
    found = []
    
    if isinstance(results, list):
        for item in results:
            if isinstance(item, dict) and 'text' in item:
                for keyword in keywords:
                    if keyword.lower() in item['text'].lower():
                        found.append(item)
                        break
    
    return found


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 vision-ocr.py <image_path> [keywords...]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    keywords = sys.argv[2:] if len(sys.argv) > 2 else ['deposit', 'sign', 'confirm']
    
    print(f"OCR 分析: {image_path}")
    print(f"关键词: {keywords}")
    print("-" * 50)
    
    # 执行 OCR
    results = ocr_screenshot(image_path)
    
    if isinstance(results, list):
        print(f"识别到 {len(results)} 个文本区域:")
        for item in results:
            if isinstance(item, dict):
                text = item.get('text', '')
                x = item.get('x', 0)
                y = item.get('y', 0)
                
                # 检查是否匹配关键词
                matched = any(kw.lower() in text.lower() for kw in keywords)
                marker = "✅" if matched else "  "
                
                print(f"{marker} [{x:4d}, {y:4d}] {text[:50]}")
    else:
        print(f"OCR 结果: {results}")
