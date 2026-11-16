# usage-meter（使用率メーター）

Claude Code の使用率を、チャットの下（入力欄のすぐ上）に1行で出すメーターです。

- **5時間**：5時間の枠をどれだけ使ったか（％と、元に戻るまでの時間）
- **週**：1週間の枠をどれだけ使ったか
- **会話**：いまの会話の長さ

70%をこえると黄色、80%をこえると赤になります。`/meter` と打つと、横に大きめのパネルが開きます。

## 入れ方

ターミナルの Claude Code で、次の1行を打ちます。

```
/plugin install usage-meter --marketplace momochan1011/usage-meter
```

「Add marketplace?」と聞かれたら `y`、入れる範囲を聞かれたら Enter（いちばん上の user）を押します。

ターミナル（シェル）から入れるときは、こちらです。

```
claude plugin install usage-meter --marketplace momochan1011/usage-meter
```

デスクトップアプリでは `/plugin` が使えないので、入力欄の横の「+」→「Plugins」→「Add marketplace」に `momochan1011/usage-meter` と入れて、「Add plugin」を押します。
