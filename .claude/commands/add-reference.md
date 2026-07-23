GitHubリポジトリを参照専用フォルダ `reference/` に追加してください。

## 引数
$ARGUMENTS にリポジトリのURLまたは名前が渡されます（例: `https://github.com/user/repo` または `user/repo`）

## 手順

1. **引数を確認**: `$ARGUMENTS` からリポジトリURLまたは `user/repo` 形式の名前を取得する。省略された場合はユーザーに確認する。

2. **フォルダ名を決定**: URLの末尾またはリポジトリ名部分をフォルダ名とする（例: `repo-name`）

3. **クローン先を確認**: `/home/user/battlemath-online-date-/reference/<フォルダ名>/` が既に存在しないことを確認する。存在する場合はユーザーに確認する。

4. **クローン実行**: 以下の手順でコピーする
   - `git clone <URL> /tmp/<フォルダ名>` でいったん一時領域にクローン
   - `cp -r /tmp/<フォルダ名>/. /home/user/battlemath-online-date-/reference/<フォルダ名>/`
   - `rm -rf /home/user/battlemath-online-date-/reference/<フォルダ名>/.git` で .git を削除
   - `rm -rf /tmp/<フォルダ名>` で一時ファイルを削除

5. **除外設定を確認**: `.gitignore` と `.vercelignore` に `reference/` が含まれているか確認し、含まれていない場合は追加する。

6. **結果を報告**: 追加されたフォルダ構成と、読み取り可能なファイル一覧を表示する。

## 注意
- `.git` フォルダは必ず削除すること（メインリポジトリのGit管理と干渉するため）
- `reference/` は `.gitignore` により GitHubにはアップされず、ローカルのClaude分析専用となる
- Vercelのビルドにも含まれない（`.vercelignore` で除外済み）
