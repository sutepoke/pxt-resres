/** --- 初期設定 --- */
/** ※MakeCodeの「拡張機能」から上記URL/識別子を追加してください。 */
/** 前回のボタン状態（変化を検知するため） */
/** --- モード切り替え関数 --- */
/** 拡張機能 `bluetooth bsieve/rmicrobit-pxt-blehid` がプロジェクトに追加されている前提です */
/** ボタンとタッチの現在の状態 (True: 押されている / False: 離されている) */
/** --- 定数とグローバル変数 --- */
//  ロゴタッチでモード切替（押して離した時などに反応）
// update_mode_led()
input.onLogoEvent(TouchButtonEvent.Touched, function on_logo_touched() {
    
    if (current_mode == MODE_MOUSE) {
        current_mode = MODE_KEYBOARD
    } else if (current_mode == MODE_KEYBOARD) {
        current_mode = MODE_MOUSE
    }
    
})
function prosses_deg(x: number, y: number, z: number): number[] {
    //  ピッチ
    let pitch_rad = Math.atan2(-x, z)
    let pitch_deg = pitch_rad * (180 / Math.PI)
    //  ロール 
    let rool_rad = Math.atan2(-y, -z)
    let rool_deg = rool_rad * (180 / Math.PI)
    return [pitch_deg, rool_deg]
}

function process_acc(): number[] {
    let move_acc_x: number;
    let move_acc_y: number;
    
    //  ピッチ = \mathrm{atan2}(y, \sqrt{x^2 + z^2})
    //  ロール = \mathrm{atan2}(-x, z)
    let history_x = [0, 0, 0, 0]
    let history_y = [0, 0, 0, 0]
    let i = 0
    for (i = 0; i < 3; i++) {
        history_x[i] = acc_x_history[i]
        history_y[i] = acc_y_history[i]
    }
    //  4回分の移動平均を算出
    let avg_x = (history_x[0] + history_x[1] + history_x[2] + history_x[3]) / 4
    let avg_y = (history_y[0] + history_y[1] + history_y[2] + history_y[3]) / 4
    //  傾き（重力）による常時入力を防ぐための不感帯（デッドゾーン）処理
    // avg_move_x= avg_x_old-avg_x
    // sign = 1 if avg_x > 0 else -1
    if (Math.abs(avg_x) < 3) {
        move_acc_x = 0
    } else if (Math.abs(avg_x) < 6) {
        move_acc_x = avg_x
    } else if (Math.abs(avg_x) < 15) {
        move_acc_x = avg_x * 2
    } else if (Math.abs(avg_x) < 40) {
        move_acc_x = avg_x * 2.5
    } else {
        move_acc_x = 100
    }
    
    //     move_acc_x= avg_x
    // avg_move_y= avg_y_old-avg_y
    // sign = 1 if avg_y > 0 else -1
    if (Math.abs(avg_y) < 3) {
        move_acc_y = 0
    } else if (Math.abs(avg_y) < 6) {
        move_acc_y = avg_y
    } else if (Math.abs(avg_y) < 15) {
        move_acc_y = avg_y * 1.5
    } else if (Math.abs(avg_y) < 45) {
        move_acc_y = avg_y * 2
    } else {
        move_acc_y = 90
    }
    
    // move_acc_y= avg_y
    avg_x_old = avg_x
    avg_y_old = avg_y
    // sign = 1 if avg > 0 else -1
    // diff = abs(avg) - THRESHOLD
    //  【移動量の可変処理】
    //  ゆっくり（変化小）なら小さく、早く（変化大）なら乗算して大きく動かす
    // if diff < 50:
    //     move = diff * 1.5 * sign
    // else:
    //  ゆっくり動かした時
    //     move = diff * 0.8 * sign
    //  素早く動かした時
    return [move_acc_x, move_acc_y]
}

function update_mode_led() {
    if (current_mode == MODE_MOUSE) {
        led.plot(4, 0)
        led.unplot(4, 4)
    } else if (current_mode == MODE_KEYBOARD) {
        led.plot(4, 4)
        led.unplot(4, 0)
    }
    
    if (p0_now == true) {
        led.plot(0, 0)
    } else if (p0_now == false) {
        led.unplot(0, 0)
    }
    
}

let btn_b_now = false
let btn_a_now = false
let p0_now = false
let logo_now = false
// diff = 0
// THRESHOLD = 0
// avg = 0
let avg_x_old = 0
let avg_y_old = 0
let move_y_old = 0
let MODE_MOUSE = 0
let MODE_KEYBOARD = 1
let current_mode = MODE_MOUSE
let acc_x_history = [0, 0, 0, 0]
let acc_y_history = [0, 0, 0, 0]
// acc_z_history = [-1023, -1023, -1023, -1023]
//  初期設定
// update_mode_led()
serial.redirectToUSB()
//  必要に応じて、ここでBluetoothマウスサービスの開始処理を呼び出します
mouse.startMouseService()
//  --- メインループ ---
basic.forever(function on_forever() {
    let scroll_val: number;
    let move_y_old_flag: number;
    let move_reng: number;
    let is_changed: any;
    let btn_a_prev2: boolean;
    let btn_b_prev2: boolean;
    
    let [move_ax, move_ay] = process_acc()
    // 横向き（ロゴが右）
    let move_x = move_ay * -1
    let move_y = move_ax * -1
    update_mode_led()
    //  キーボードモード時は待機（今回は何も動作させない）
    if (current_mode == MODE_MOUSE) {
        // move_z = process_acc(3)
        // move_x = input.rotation(Rotation.ROLL)
        // move_y = input.rotation(Rotation.PITCH)
        //  2. スクロール処理 (P0タッチ時)
        scroll_val = 0
        if (p0_now) {
            // if scroll_val == 0:
            if (move_y_old_flag == 0) {
                move_y_old = move_y
                move_y_old_flag = 1
            }
            
            //  P0タッチ中は、前後の加速度(Y軸)をスクロールに変換
            // if abs(move_y) > 0 :
            move_reng = Math.abs(Math.abs(move_y_old) - Math.abs(move_y))
            if (move_reng > 0) {
                // scroll_val = 1 if move_y > 0 else -1
                if (move_reng < 3) {
                    scroll_val = 0
                } else if (move_reng < 9) {
                    scroll_val = move_y > 0 ? 1 : -1
                } else if (move_reng < 20) {
                    scroll_val = move_y > 0 ? 2 : -2
                } else if (move_reng < 45) {
                    scroll_val = move_y > 0 ? 3 : -3
                } else {
                    scroll_val = move_y > 0 ? 5 : -5
                }
                
                move_y_old = move_y
                move_y = 0
            }
            
        } else if (p0_now == false) {
            move_y_old_flag = 0
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
    
    // (pitch,rool)=prosses_deg(move_x,move_y,move_z)
    serial.writeValue("x     ", move_x)
    serial.writeValue("y     ", move_y)
    serial.writeValue("scroll", scroll_val)
    // serial.write_value("y ", raw_y)
    basic.pause(20)
})
control.inBackground(function on_in_background() {
    
    while (true) {
        //  ボタンとエッジコネクタ(P0)の「タッチされているか」の状態を取得
        btn_a_now = input.buttonIsPressed(Button.A)
        btn_b_now = input.buttonIsPressed(Button.B)
        p0_now = input.pinIsPressed(TouchPin.P0)
        logo_now = input.logoIsPressed()
        //  加速度センサーの値を取得 (-2046 〜 2046)
        //  ※表面を正面（ロゴが右、Aボタンが手前）にした場合、
        //  必要に応じてxとyの軸や符号を調整してください。
        // raw_x = input.acceleration(Dimension.X)
        // raw_y = input.acceleration(Dimension.Y)
        // raw_z = input.acceleration(Dimension.Z)
        //  履歴の更新（最新を先頭に挿入し、古いものを削除）
        acc_x_history.insertAt(0, input.rotation(Rotation.Roll))
        // acc_x_history.insert_at(0, raw_x)
        _py.py_array_pop(acc_x_history)
        acc_y_history.insertAt(0, input.rotation(Rotation.Pitch))
        // acc_y_history.insert_at(0, raw_y)
        _py.py_array_pop(acc_y_history)
        // acc_z_history.insert_at(0, raw_z)
        // acc_z_history.pop()
        // (pitch,rool)=prosses_deg(raw_x,raw_y,raw_z)
        // serial.write_value("x     ", input.rotation(Rotation.ROLL))
        // serial.write_value("rool_x ", rool)
        // serial.write_value("y ", raw_y)
        // serial.write_value("z", raw_z)
        //  control.wait_micros(20000)
        basic.pause(20)
    }
})
