# Media Parser

一个高效的网页媒体资源解析服务，可以提取网页中的视频和音频资源。

## 功能特点

- 支持解析网页中的视频和音频资源
- 自动获取文件大小和类型信息
- 优化性能，阻止不必要的资源加载
- 支持 TypeScript
- 使用 Puppeteer 进行网页解析

## 安装

```bash
npm install
```

## 开发

```bash
npm run dev
```

## 构建

```bash
npm run build
```

## 运行

```bash
npm start
```

## API 使用

### 解析媒体资源

**请求**

```http
POST /parse
Content-Type: application/json

{
  "url": "https://example.com"
}
```

**响应**

```json
{
  "data": [
    {
      "filename": "video.mp4",
      "type": "video/mp4",
      "url": "https://example.com/videos/video.mp4",
      "size": "24.58 MB"
    }
  ]
}
```

## 技术栈

- Node.js
- TypeScript
- Express
- Puppeteer
- Axios

## 注意事项

- 确保目标网站允许爬虫访问
- 某些网站可能需要特定的请求头或认证信息
- 建议在生产环境中添加适当的速率限制和错误处理 