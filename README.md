# 扫码答题

这是一个基于 Flask 的扫码答题项目。

## 目录结构

```text
扫码答题/
├── app.py
├── questions.json
├── quiz_store.json
├── requirements.txt
├── README.md
├── templates/
│   ├── index.html
│   └── quiz.html
└── static/
    ├── club-logo.jpg
    ├── style.css
    └── quiz.js
```

## 本地运行

```powershell
cd E:\code\python实践\扫码答题
python -m pip install -r requirements.txt
python app.py
```

打开首页后点击“生成新的答题二维码”，页面会生成一个公网可用的答题链接二维码。

## 云端部署推荐方式

1. 把 `扫码答题` 目录上传到云服务器。
2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 设置公网地址环境变量：

```bash
export PUBLIC_BASE_URL=https://quiz.example.com
```

4. 用生产服务器启动：

```bash
gunicorn -w 2 -b 127.0.0.1:8000 app:app
```

5. 用 Nginx 反向代理到 `127.0.0.1:8000`。
6. 在首页生成二维码，手机扫描后会打开 `https://quiz.example.com/quiz/<id>`。

## 题库来源

当前程序只读取同级目录下的 `questions.json`。  
所以把整个 `扫码答题` 文件夹上传到云服务器即可，不需要再带上上一级目录里的其他文件。
