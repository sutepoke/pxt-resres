# 拡張機能 `bluetooth bsieve/rmicrobit-pxt-blehid` がプロジェクトに追加されている前提です
# ※MakeCodeの「拡張機能」から上記URL/識別子を追加してください。

# --- グローバル変数・状態管理 ---
# 加速度の履歴（ノイズ除去・静止判定用：最新, 前, 前々, 前々々）
hist_x = [0, 0, 0, 0]
hist_y = [0, 0, 0, 0]

# ボタンとタッチの最新状態
btn_a_pressed = False
btn_b_pressed = False
p0_touched = False
p1_touched = False
p2_touched = False

# スクロール判定用のタイムスタンプと状態
last_touch_time = 0
scroll_step = 0 # 0:なし, 1:P0検出, 2:P1検出(下), -1:P2検出, -2:P1検出(上)
scroll_val = 0  # メインループに渡すスクロール量

# --- バックグラウンド状態監視タスク (20ms周期) ---
def stuck_monitor():
    global btn_a_pressed, btn_b_pressed, p0_touched, p1_touched, p2_touched
    global hist_x, hist_y, scroll_step, scroll_val, last_touch_time
    
    while True:
        # 1. ボタン状態の取得
        btn_a_pressed = input.button_is_pressed(Button.A)
        btn_b_pressed = input.button_is_pressed(Button.B)
        
        # 2. エッジコネクタのタッチ状態取得
        p0 = input.pin_is_pressed(TouchPin.P0)
        p1 = input.pin_is_pressed(TouchPin.P1)
        p2 = input.pin_is_pressed(TouchPin.P2)
        
        # 3. 加速度センサー値の取得と履歴シフト（平行移動用）
        # ※ロゴ右側・Aボタン正面の場合、ピッチ/ロールの傾きではなく、
        # 純粋なX/Yの瞬間的な加速度の変化（高通フィルター的な処理）で平行移動を捉えます。
        raw_x = input.acceleration(Dimension.X)
        raw_y = input.acceleration(Dimension.Y)
        
        hist_x.insert(0, raw_x)
        hist_x.pop()
        hist_y.insert(0, raw_y)
        hist_y.pop()
        
        # 4. エッジセンサーによるスライドスクロール判定
        # タイムアウト処理（1秒以上経過したらリセット）
        now = control.millis()
        if now - last_touch_time > 1000:
            scroll_step = 0
            
        # 【下スクロール判定: 0 -> 1 -> 2】
        if p0 and scroll_step == 0:
            scroll_step = 1
            last_touch_time = now
        elif p1 and scroll_step == 1:
            scroll_step = 2
            last_touch_time = now
        elif p2 and scroll_step == 2:
            scroll_val = -1 # 下スクロール(HID側でマイナスかプラスかはOS依存、適宜調整)
            scroll_step = 0
            
        # 【上スクロール判定: 2 -> 1 -> 0】
        elif p2 and scroll_step == 0:
            scroll_step = -1
            last_touch_time = now
        elif p1 and scroll_step == -1:
            scroll_step = -2
            last_touch_time = now
        elif p0 and scroll_step == -2:
            scroll_val = 1  # 上スクロール
            scroll_step = 0
            
        basic.pause(20)

# バックグラウンドタスクの起動
control.in_background(stuck_monitor)

# --- 傾き（重力）除去と移動量計算関数 ---
def calculate_movement():
    # 履歴の差分を取ることで、持続的な重力加速度（傾き）を相殺し、
    # 手を「シュッ」と動かした時の平行移動（高周波成分）だけを抽出します。
    diff_x = hist_x[0] - hist_x[3]
    diff_y = hist_y[0] - hist_y[3]
    
    # 不感帯（デッドゾーン）の設定：小さなノイズ（手の震えなど）を無視
    if abs(diff_x) < 80:
        diff_x = 0
    if abs(diff_y) < 80:
        diff_y = 0
        
    # 可変速（加速）アルゴリズム
    # ゆっくり（値が小さい）なら移動量小、速い（値が大きい）なら二次関数的に移動量大
    move_x = int((diff_x / 100) * (abs(diff_x) / 100))
    move_y = int((diff_y / 100) * (abs(diff_y) / 100))
    
    # 向きの調整（ロゴ右・A正面の座標系に合わせる。必要に応じて `-` を反転させてください）
    return move_x, move_y

# --- メイン初期化とループ ---
# Bluetoothマウスサービスの開始
# (拡張機能の仕様に合わせて呼び出しています。実際のAPI名が `mouse.start_mouse_service()` である前提)
mouse.start_mouse_service()

while True:
    # タッチロゴに触れているか確認
    if input.logo_is_pressed():
        # ======= マウスモード =======
        #basic.show_icon(IconNames.SMALL_DIAMOND) # マウスモード中のインジケータ
        led.plot(0, 0)
        led.unplot(0, 4)
        # 移動量の計算
        mx, my = calculate_movement()
        
        # スクロール値の取得とリセット
        curr_scroll = scroll_val
        scroll_val = 0 
        
        # Bluetooth一括送信
        # hold=Trueにすることで、ボタンが押されている間は「長押し維持」になります。
        # ボタンA -> left, ボタンB -> right
        mouse.send(mx, my, btn_a_pressed, False, btn_b_pressed, curr_scroll, True)
        
    else:
        # ======= キーボードモード =======
        #basic.show_icon(IconNames.STICK_FIGURE) # キーボードモード中のインジケータ
        led.plot(0, 4)
        led.unplot(0, 0)
        # 今回は何もしないため空けておきます
        pass
        
    basic.pause(20)