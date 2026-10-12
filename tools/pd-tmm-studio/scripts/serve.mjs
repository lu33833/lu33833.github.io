import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 从项目根目录读取静态文件，PORT 可覆盖默认端口
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// 开发服务只处理页面和前端资源，所有计算仍在浏览器内运行
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // 路径白名单只开放页面和 src 下的脚本、样式
    if (relative !== 'index.html' && !/^src\/[\w.-]+\.(?:js|css)$/.test(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(path.join(root, relative));
    // 禁用缓存，手动改完源码后刷新即可看到结果
    response.writeHead(200, {
      'Content-Type': types[path.extname(relative)],
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`PD TMM Studio: http://127.0.0.1:${port}`));
