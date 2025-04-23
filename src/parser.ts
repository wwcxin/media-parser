import * as puppeteer from 'puppeteer';
import axios from 'axios';
import { URL } from 'url';

interface MediaResource {
  filename: string;
  type: string;
  url: string;
  size: string;
}

export class MediaParser {
  private static instance: MediaParser;
  private browser: puppeteer.Browser | null = null;
  private readonly TIMEOUT = 30000; // 30秒超时
  private readonly MIN_RESOURCE_SIZE = 1024 * 1024; // 1MB，小于此大小的资源可能不是完整的媒体文件

  private constructor() {}

  public static getInstance(): MediaParser {
    if (!MediaParser.instance) {
      MediaParser.instance = new MediaParser();
    }
    return MediaParser.instance;
  }

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions'
        ],
        executablePath: process.env.CHROME_PATH || undefined
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getFileSize(url: string): Promise<string> {
    try {
      const response = await axios.head(url);
      const size = response.headers['content-length'];
      if (!size) return 'Unknown';
      
      const sizeInMB = (parseInt(size) / (1024 * 1024)).toFixed(2);
      return `${sizeInMB} MB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const filename = pathname.split('/').pop() || 'unknown';
      return filename;
    } catch {
      return 'unknown';
    }
  }

  private async isResourceValid(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url);
      const size = response.headers['content-length'];
      if (!size) return false;
      
      const sizeInBytes = parseInt(size);
      return sizeInBytes >= this.MIN_RESOURCE_SIZE;
    } catch {
      return false;
    }
  }

  // 主要解析方法
  private async parseMain(url: string): Promise<MediaResource[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const mediaResources: MediaResource[] = [];
    
    try {
      // 设置请求拦截
      await page.setRequestInterception(true);
      page.on('request', (request: puppeteer.HTTPRequest) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // 监听网络请求
      page.on('response', async (response: puppeteer.HTTPResponse) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (contentType.includes('video/') || contentType.includes('audio/')) {
          const size = response.headers()['content-length'];
          if (size && parseInt(size) >= this.MIN_RESOURCE_SIZE) {
            const resource: MediaResource = {
              filename: this.getFilenameFromUrl(url),
              type: contentType,
              url: url,
              size: `${(parseInt(size) / (1024 * 1024)).toFixed(2)} MB`
            };
            mediaResources.push(resource);
          }
        }
      });

      // 导航到页面
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.TIMEOUT 
      });

      // 等待一段时间，确保资源加载
      await new Promise(resolve => setTimeout(resolve, 5000));

      return mediaResources;
    } finally {
      await page.close();
    }
  }

  // 备选解析方法
  private async parseAlternative(url: string): Promise<MediaResource[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const mediaResources: MediaResource[] = [];
    
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.TIMEOUT
      });

      // 等待视频元素加载
      await page.waitForSelector('video, audio', { timeout: 5000 });

      // 从页面元素中获取资源
      const pageResources = await page.evaluate(() => {
        const resources: any[] = [];
        
        // 获取所有 video 标签
        document.querySelectorAll('video').forEach(video => {
          if (video.src) {
            resources.push({
              filename: video.src.split('/').pop() || 'unknown',
              type: 'video/mp4',
              url: video.src,
              size: 'Unknown'
            });
          }
        });

        // 获取所有 audio 标签
        document.querySelectorAll('audio').forEach(audio => {
          if (audio.src) {
            resources.push({
              filename: audio.src.split('/').pop() || 'unknown',
              type: 'audio/mpeg',
              url: audio.src,
              size: 'Unknown'
            });
          }
        });

        // 获取所有 source 标签
        document.querySelectorAll('source').forEach(source => {
          if (source.src) {
            resources.push({
              filename: source.src.split('/').pop() || 'unknown',
              type: source.type || 'unknown',
              url: source.src,
              size: 'Unknown'
            });
          }
        });

        // 从页面数据中获取
        const scripts = Array.from(document.getElementsByTagName('script'));
        for (const script of scripts) {
          const content = script.textContent || '';
          // 匹配视频地址
          const urlMatch = content.match(/\"(http[^\"]+\.(mp4|m3u8|mp3)[^\"]*)\"/);
          if (urlMatch) {
            resources.push({
              filename: urlMatch[1].split('/').pop() || 'unknown',
              type: urlMatch[1].endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
              url: urlMatch[1],
              size: 'Unknown'
            });
          }
        }

        return resources;
      });

      // 验证资源有效性
      for (const resource of pageResources) {
        if (await this.isResourceValid(resource.url)) {
          resource.size = await this.getFileSize(resource.url);
          mediaResources.push(resource);
        }
      }

      return mediaResources;
    } finally {
      await page.close();
    }
  }

  // 公开的解析方法
  public async parse(url: string): Promise<{ data: MediaResource[] }> {
    try {
      // 首先尝试主要解析方法
      const mainResources = await this.parseMain(url);
      if (mainResources.length > 0) {
        return { data: mainResources };
      }

      // 如果主要方法没有找到资源，尝试备选方案
      console.log('主要解析方法未找到资源，尝试备选方案...');
      const alternativeResources = await this.parseAlternative(url);
      return { data: alternativeResources };
    } catch (error) {
      console.error('解析失败:', error);
      throw error;
    }
  }
} 