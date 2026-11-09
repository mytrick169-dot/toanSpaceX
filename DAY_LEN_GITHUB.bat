@echo off
chcp 65001 >nul
title ĐẨY DỰ ÁN SPACE X MATH LÊN GITHUB (mytrick169-dot/toanSpaceX)
echo ================================================================================
echo   ĐANG ĐẨY SOURCE CODE LÊN GITHUB: https://github.com/mytrick169-dot/toanSpaceX
echo ================================================================================
git add .
git commit -m "Update Space X Math production" 2>nul
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/mytrick169-dot/toanSpaceX.git
git push -u origin main
echo ================================================================================
pause
