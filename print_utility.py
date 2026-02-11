
import tempfile
import os
import time
import sys

# 必要なライブラリのインポートチェック
try:
    import win32api
    import win32print
except ImportError:
    print("Error: 'pywin32' library is required. Please install it using 'pip install pywin32'.")
    sys.exit(1)

def print_text_content(text_content, max_retries=3, initial_wait=2):
    """
    指定されたテキスト内容を印刷します。
    テキスト先頭に ::PRINTER::PrinterName がある場合、そのプリンタを使用します。
    
    Args:
        text_content (str): 印刷するテキストデータ
        max_retries (int): 最大リトライ回数
        initial_wait (int): リトライ時の初期待機時間(秒)
    """
    
    target_printer = None
    content_to_print = text_content
    
    # プリンタ指定ヘッダーの解析
    lines = text_content.splitlines()
    if lines and lines[0].startswith("::PRINTER::"):
        target_printer = lines[0].replace("::PRINTER::", "").strip()
        # ヘッダー行を除去して印刷内容とする
        content_to_print = "\n".join(lines[1:])
        print(f"Target Printer detected: {target_printer}")

    # 一時ファイルのパスを生成
    fd, file_path = tempfile.mkstemp(suffix=".txt", text=True)
    
    original_default_printer = None
    
    try:
        # 現在の既定のプリンタを保存
        try:
            original_default_printer = win32print.GetDefaultPrinter()
        except Exception as e:
            print(f"Warning: Could not get default printer: {e}")

        # 指定プリンタがある場合、一時的に既定のプリンタを変更
        if target_printer:
            try:
                print(f"Switching default printer to: {target_printer}")
                win32print.SetDefaultPrinter(target_printer)
            except Exception as e:
                print(f"Error switching printer: {e}")
                print("Falling back to current default printer.")
                target_printer = None # 失敗した場合は既定のまま進める

        print("Preparing print job...")
        
        # ファイルに書き込み (CP932で保存して文字化け防止)
        with os.fdopen(fd, 'w', encoding='cp932', errors='replace') as f:
            f.write(content_to_print)
            
        # 印刷実行（リトライ処理付き）
        success = False
        last_exception = None
        wait_time = initial_wait

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"Retry attempt {attempt + 1}/{max_retries}...")
                
                # ShellExecuteの"print"動詞は既定のプリンタを使用する
                win32api.ShellExecute(
                    0,
                    "print",
                    file_path,
                    None,
                    ".",
                    0
                )
                
                print("Print job sent successfully.")
                success = True
                break
                
            except Exception as e:
                last_exception = e
                print(f"Error executing print command (Attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(wait_time)
                    wait_time *= 2
        
        if not success:
            raise Exception(f"Failed to send print job. Last error: {last_exception}")
        
        print("Waiting for print spooling...")
        time.sleep(5)
        
    except Exception as e:
        print(f"An error occurred during printing: {e}")
        
    finally:
        # 既定のプリンタを元に戻す
        if original_default_printer and target_printer:
            try:
                print(f"Restoring default printer to: {original_default_printer}")
                win32print.SetDefaultPrinter(original_default_printer)
            except Exception as e:
                print(f"Warning: Failed to restore default printer: {e}")

        # 一時ファイルの削除
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print("Temporary file cleaned up.")
            except:
                pass

if __name__ == "__main__":
    # コマンドライン引数がある場合はそのファイルを読み込んで印刷
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
        if os.path.exists(target_file):
            try:
                # 入力ファイルはUTF-8などを想定して読み込む
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                print(f"Processing file: {target_file}")
                print_text_content(content)
            except Exception as e:
                print(f"Error reading file: {e}")
        else:
            print(f"File not found: {target_file}")
    else:
        print("Usage: python print_utility.py <filename>")
