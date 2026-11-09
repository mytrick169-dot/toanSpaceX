@echo off
chcp 65001 >nul
title TRIỂN KHAI SPACE X MATH LÊN GITHUB & CLOUD 24/7 (toanSpaceX)
echo ================================================================================
echo   🚀 BƯỚC 1: TẠO KHO CHỨA (REPOSITORY) "toanSpaceX" TRÊN GITHUB CỦA BẠN
echo ================================================================================
echo.
echo Hệ thống đang mở sẵn trang Tạo Repository trên trình duyệt GitHub của bạn...
echo 👉 На trang web vừa mở, bạn chỉ cần kéo xuống dưới và nhấn nút màu xanh:
echo    [Create repository]
echo.
start "" "https://github.com/new?name=toanSpaceX&description=Space+X+Math+-+Nen+tang+Hoc+tap+va+Luyen+thi+Toan+THPT+bang+AI"
pause

echo.
echo ================================================================================
echo   🚀 BƯỚC 2: ĐẨY TOÀN BỘ MÃ NGUỒN LÊN GITHUB (mytrick169-dot/toanSpaceX)
echo ================================================================================
echo Đang làm mới phiên đăng nhập GitHub trên máy tính (nếu có cửa sổ GitHub hiện lên,
echo hãy nhấn "Sign in with your browser" / "Authorize")...
cmdkey /delete:git:https://github.com >nul 2>&1
cmdkey /delete:LegacyGeneric:target=git:https://github.com >nul 2>&1

git add -A
git commit -m "Update Space X Math production (toanSpaceX.com)" >nul 2>&1
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/mytrick169-dot/toanSpaceX.git
git push -u origin main --force

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ================================================================================
  echo   ✅ ĐÃ ĐẨY CODE LÊN GITHUB THÀNH CÔNG!
  echo   🌐 Kho mã nguồn: https://github.com/mytrick169-dot/toanSpaceX
  echo --------------------------------------------------------------------------------
  echo   🚀 BƯỚC 3: KÍCH HOẠT MÁY CHỦ CLOUD 24/7 (RENDER.COM)
  echo   Đang mở trang kết nối tự động với Render Cloud...
  echo   (Sau khi đăng nhập Render bằng tài khoản GitHub mytrick169-dot, nhấn Apply
  echo    để nhận ngay đường link cố định: https://toanspacex.onrender.com)
  echo ================================================================================
  start "" "https://dashboard.render.com/blueprint/new?repo=https://github.com/mytrick169-dot/toanSpaceX"
) else (
  echo.
  echo ⚠️ Chưa xác thực xong GitHub. Hãy chạy lại file DAY_LEN_GITHUB.bat và nhấn "Sign in with your browser".
)
echo.
pause
