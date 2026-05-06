<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        :root {
            --mint-light: #F2F8F5; /* 淡薄荷綠背景 */
            --choco-dark: #3E2723; /* 巧克力深棕色 */
            --mint-medium: #8BC34A; /* 薄荷綠主色 */
            --text-on-mint: #FFFFFF;
        }

        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: var(--mint-light);
            color: var(--choco-dark);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .hello-box {
            background-color: #FFFFFF;
            padding: 60px 80px;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            border: 2px solid rgba(139, 195, 74, 0.2);
            text-align: center;
        }

        h1 {
            font-size: 6rem;
            margin: 0;
            color: var(--mint-medium);
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.15);
        }

        p {
            margin-top: 20px;
            font-size: 1.8rem;
            color: var(--choco-dark);
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="hello-box">
        <h1>Hello, World!</h1>
        <p>薄荷巧克力配色風格</p>
    </div>
</body>
</html>
