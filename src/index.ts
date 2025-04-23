import express from 'express';
import { MediaParser } from './parser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// 获取解析器实例
const parser = MediaParser.getInstance();

// 初始化解析器
parser.init().catch(console.error);

// 处理进程退出
process.on('SIGINT', async () => {
  await parser.close();
  process.exit(0);
});

// 提供静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 添加根路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(express.json());

app.post('/parse', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await parser.parse(url);
    res.json(result);
  } catch (error) {
    console.error('Error parsing URL:', error);
    res.status(500).json({ error: 'Failed to parse URL' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 