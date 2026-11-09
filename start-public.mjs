import { spawn } from 'node:child_process';
import net from 'node:net';
import { ENV } from './src/backend/config/env.mjs';

const PORT = Number(process.env.PORT || ENV.PORT || 3000);

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net
      .createConnection({ host: '127.0.0.1', port }, () => {
        tester.end();
        resolve(true);
      })
      .on('error', () => {
        resolve(false);
      });
  });
}

async function main() {
  const alreadyRunning = await checkPortInUse(PORT);
  if (!alreadyRunning) {
    console.log(`[Space X Math] Đang khởi động máy chủ nội bộ tại cổng ${PORT}...`);
    const { server } = await import('./server.mjs');
    await new Promise((resolve) => server.listen(PORT, '0.0.0.0', resolve));
    console.log(`[Space X Math] Đã khởi động máy chủ tại http://localhost:${PORT}`);
  } else {
    console.log(`[Space X Math] Máy chủ tại cổng ${PORT} đang hoạt động sẵn.`);
  }

  console.log(`[Space X Math] Đang khởi tạo Đường dẫn Công khai HTTPS (Cloudflare Tunnel)...`);

  const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let announced = false;
  const handleOutput = (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !announced) {
      announced = true;
      const publicUrl = match[0];
      console.log(`\n================================================================================`);
      console.log(`🌐 ĐƯỜNG LINK CÔNG KHAI CHO HỌC SINH ĐÃ SẴN SÀNG (HTTPS TOÀN CẦU):`);
      console.log(`👉 Link Trang chủ / Đăng nhập:   ${publicUrl}/#/login`);
      console.log(`👉 Link Tạo tài khoản Học sinh:  ${publicUrl}/#/register`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`✅ Học sinh dùng điện thoại (4G/WiFi) hoặc máy tính bất kỳ chỉ cần mở link trên`);
      console.log(`   là có thể tự tạo tài khoản và vào làm đề thi ngay lập tức!`);
      console.log(`================================================================================\n`);
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('error', (err) => {
    console.error('[Space X Math] Không thể khởi chạy cloudflared:', err.message);
  });
}

main();
