"""

--- モード切り替え関数 ---

"""
"""

--- 初期設定 ---

"""
"""

拡張機能 `bluetooth bsieve/rmicrobit-pxt-blehid` がプロジェクトに追加されている前提です

"""
"""

※MakeCodeの「拡張機能」から上記URL/識別子を追加してください。

"""
"""

ボタンとタッチの現在の状態 (True: 押されている / False: 離されている)

"""
"""

前回のボタン状態（変化を検知するため）

"""
"""

--- 定数とグローバル変数 ---

"""
MODE_MOUSE = 0
MODE_KEYBOARD = 1

# ロゴタッチでモード切替（押して離した時などに反応）
def on_logo_touched():
    global current_mode
    if current_mode == MODE_MOUSE:
        current_mode = MODE_KEYBOARD
    else:
        current_mode = MODE_MOUSE
    update_mode_led()
input.on_logo_event(TouchButtonEvent.TOUCHED, on_logo_touched)

def process_acc(xy: number):
    
    if xy == 0:
        for i in range (3):
        history[i] = int(acc_x_history[i] *0.1)
    else:
        for i in range (3):
        history[i] = int(acc_y_history[i] *0.1)
    

    # 4回分の移動平均を算出
    avg = (history[0] + history[1] + history[2] + history[3] ) / 4
    
    # 傾き（重力）による常時入力を防ぐための不感帯（デッドゾーン）処理
    # 平行移動の「一瞬の加速」だけを拾うため、閾値を設定
    if avg = history[0]:
        return 0
    THRESHOLD = 15

    sign = 1 if avg > 0 else -1
    diff = abs(avg) - THRESHOLD
    # 【移動量の可変処理】
    # ゆっくり（変化小）なら小さく、早く（変化大）なら乗算して大きく動かす
    if diff < 30:
        move = diff * 0.3 * sign
    else:
        # ゆっくり動かした時
        move = diff * 1 * sign
    # 素早く動かした時
    return int(move)
def update_mode_led():
    if current_mode == MODE_MOUSE:
        led.plot(0, 0)
        led.unplot(0, 4)
    else:
        led.plot(0, 4)
        led.unplot(0, 0)
btn_b_now = False
btn_a_now = False
p0_now = False
current_mode = MODE_MOUSE
acc_x_history = [0, 0, 0, 0]
acc_y_history = [0, 0, 0, 0]

# 初期設定
update_mode_led()
# 必要に応じて、ここでBluetoothマウスサービスの開始処理を呼び出します
mouse.start_mouse_service()
# --- メインループ ---
def on_forever():
    # キーボードモード時は待機（今回は何も動作させない）
    if current_mode == MODE_MOUSE:
        move_x = process_acc(0)
        move_y = process_acc(1)
        # 2. スクロール処理 (P0タッチ時)
        scroll_val = 0
        if p0_now:
            # P0タッチ中は、前後の加速度(Y軸)をスクロールに変換
            if abs(move_y) > 0:
                scroll_val = 1 if move_y > 0 else -1
                move_y = 0
        # スクロール中はカーソル上下移動を相殺
        # 3. ボタン状態の変化チェック
        # 長押し(hold)に対応するため、状態が変わったとき、またはボタンが押され続けている時に送信
        is_changed = move_x != 0 or move_y != 0 or scroll_val != 0 or btn_a_now != btn_a_prev2 or btn_b_now != btn_b_prev2 or btn_a_now or btn_b_now
        if is_changed:
            # hold=Trueにすることで、ボタンが押されている間はドラッグ（長押し）状態を維持します
            # mouse.send(x, y, left, middle, right, scroll, hold)
            mouse.send(move_x,
                move_y,
                btn_a_now,
                False,
                btn_b_now,
                scroll_val,
                True)
        # 前回の状態を保存
        btn_a_prev2 = btn_a_now
        btn_b_prev2 = btn_b_now
    elif current_mode == MODE_KEYBOARD:
        pass
    basic.pause(20)
basic.forever(on_forever)

def on_in_background():
    global btn_a_now, btn_b_now, p0_now
    while True:
        # ボタンとエッジコネクタ(P0)の「タッチされているか」の状態を取得
        btn_a_now = input.button_is_pressed(Button.A)
        btn_b_now = input.button_is_pressed(Button.B)
        p0_now = input.pin_is_pressed(TouchPin.P0)
        # 加速度センサーの値を取得 (-2046 〜 2046)
        # ※表面を正面（ロゴが右、Aボタンが手前）にした場合、
        # 必要に応じてxとyの軸や符号を調整してください。
        raw_x = input.acceleration(Dimension.X)
        raw_y = input.acceleration(Dimension.Y)
        # 履歴の更新（最新を先頭に挿入し、古いものを削除）
        acc_x_history.insert_at(0, raw_x)
        acc_x_history.pop()
        acc_y_history.insert_at(0, raw_y)
        acc_y_history.pop()
        # control.wait_micros(20000)
        basic.pause(200)
control.in_background(on_in_background)
