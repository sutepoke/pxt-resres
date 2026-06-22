/** --- モード切り替え関数 --- */
/** --- 初期設定 --- */
/** 拡張機能 `bluetooth bsieve/rmicrobit-pxt-blehid` がプロジェクトに追加されている前提です */
/** ※MakeCodeの「拡張機能」から上記URL/識別子を追加してください。 */
/** ボタンとタッチの現在の状態 (True: 押されている / False: 離されている) */
/** 前回のボタン状態（変化を検知するため） */
/** --- 定数とグローバル変数 --- */
let MODE_MOUSE = 0
let MODE_KEYBOARD = 1
//  ロゴタッチでモード切替（押して離した時などに反応）
input.onLogoEvent(TouchButtonEvent.Touched, function on_logo_touched() {
    
    if (current_mode == MODE_MOUSE) {
        current_mode = MODE_KEYBOARD
    } else {
        current_mode = MODE_MOUSE
    }
    
    update_mode_led()
})
function process_acc(xy: number): number {
    let history: number[];
    let move: number;
    if (xy == 0) {
        history = acc_x_history
    } else {
        history = acc_y_history
    }
    
    //  3回分の移動平均を算出
    let avg = (history[0] + history[1] + history[2]) / 3
    //  傾き（重力）による常時入力を防ぐための不感帯（デッドゾーン）処理
    //  平行移動の「一瞬の加速」だけを拾うため、閾値を設定
    let THRESHOLD = 150
    if (Math.abs(avg) < THRESHOLD) {
        return 0
    }
    
    let sign = avg > 0 ? 1 : -1
    let diff = Math.abs(avg) - THRESHOLD
    //  【移動量の可変処理】
    //  ゆっくり（変化小）なら小さく、早く（変化大）なら乗算して大きく動かす
    if (diff < 300) {
        move = diff * 0.03 * sign
    } else {
        //  ゆっくり動かした時
        move = diff * 0.1 * sign
    }
    
    //  素早く動かした時
    return Math.trunc(move)
}

function update_mode_led() {
    if (current_mode == MODE_MOUSE) {
        led.plot(0, 0)
        led.unplot(0, 4)
    } else {
        led.plot(0, 4)
        led.unplot(0, 0)
    }
    
}

let btn_b_now = false
let btn_a_now = false
let p0_now = false
let current_mode = MODE_MOUSE
let acc_x_history = [0, 0, 0]
let acc_y_history = [0, 0, 0]
//  初期設定
update_mode_led()
//  必要に応じて、ここでBluetoothマウスサービスの開始処理を呼び出します
mouse.startMouseService()
//  --- メインループ ---
basic.forever(function on_forever() {
    let move_x: number;
    let move_y: number;
    let scroll_val: number;
    let is_changed: any;
    let btn_a_prev2: boolean;
    let btn_b_prev2: boolean;
    //  キーボードモード時は待機（今回は何も動作させない）
    if (current_mode == MODE_MOUSE) {
        move_x = process_acc(0)
        move_y = process_acc(1)
        //  2. スクロール処理 (P0タッチ時)
        scroll_val = 0
        if (p0_now) {
            //  P0タッチ中は、前後の加速度(Y軸)をスクロールに変換
            if (Math.abs(move_y) > 0) {
                scroll_val = move_y > 0 ? 1 : -1
                move_y = 0
            }
            
        }
        
        //  スクロール中はカーソル上下移動を相殺
        //  3. ボタン状態の変化チェック
        //  長押し(hold)に対応するため、状態が変わったとき、またはボタンが押され続けている時に送信
        is_changed = move_x != 0 || move_y != 0 || scroll_val != 0 || btn_a_now != btn_a_prev2 || btn_b_now != btn_b_prev2 || btn_a_now || btn_b_now
        if (is_changed) {
            //  hold=Trueにすることで、ボタンが押されている間はドラッグ（長押し）状態を維持します
            //  mouse.send(x, y, left, middle, right, scroll, hold)
            mouse.send(move_x, move_y, btn_a_now, false, btn_b_now, scroll_val, true)
        }
        
        //  前回の状態を保存
        btn_a_prev2 = btn_a_now
        btn_b_prev2 = btn_b_now
    } else if (current_mode == MODE_KEYBOARD) {
        
    }
    
    basic.pause(20)
})
control.inBackground(function on_in_background() {
    let raw_x: number;
    let raw_y: number;
    
    while (true) {
        //  ボタンとエッジコネクタ(P0)の「タッチされているか」の状態を取得
        btn_a_now = input.buttonIsPressed(Button.A)
        btn_b_now = input.buttonIsPressed(Button.B)
        p0_now = input.pinIsPressed(TouchPin.P0)
        //  加速度センサーの値を取得 (-2046 〜 2046)
        //  ※表面を正面（ロゴが右、Aボタンが手前）にした場合、
        //  必要に応じてxとyの軸や符号を調整してください。
        raw_x = input.acceleration(Dimension.X)
        raw_y = input.acceleration(Dimension.Y)
        //  履歴の更新（最新を先頭に挿入し、古いものを削除）
        acc_x_history.insertAt(0, raw_x)
        _py.py_array_pop(acc_x_history)
        acc_y_history.insertAt(0, raw_y)
        _py.py_array_pop(acc_y_history)
        //  control.wait_micros(20000)
        basic.pause(200)
    }
})
