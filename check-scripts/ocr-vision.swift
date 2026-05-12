import Vision
import CoreImage
import Foundation

let args = CommandLine.arguments
guard args.count > 1 else {
    print("Usage: swift ocr-vision.swift <image_path>")
    exit(1)
}

let imagePath = args[1]
let url = URL(fileURLWithPath: imagePath)

// 读取图片
guard let imageData = try? Data(contentsOf: url),
      let ciImage = CIImage(data: imageData) else {
    print("{\"error\": \"Failed to load image\"}")
    exit(1)
}

// 创建 OCR 请求
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate

// 执行请求
let handler = VNImageRequestHandler(ciImage: ciImage)
try? handler.perform([request])

// 获取结果
var results: [[String: Any]] = []
for observation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let bbox = observation.boundingBox
    
    results.append([
        "text": candidate.string,
        "x": Int((bbox.origin.x + bbox.size.width / 2) * 1512),
        "y": Int((1 - bbox.origin.y - bbox.size.height / 2) * 982)
    ])
}

// 输出 JSON
let jsonData = try! JSONSerialization.data(withJSONObject: results)
print(String(data: jsonData, encoding: .utf8)!)
