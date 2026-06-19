let curr_scroll: number;
//  拡張機能 `bluetooth bsieve/rmicrobit-pxt-blehid` がプロジェクトに追加されている前提です
//  ※MakeCodeの「拡張機能」から上記URL/識別子を追加してください。
//  --- グローバル変数・状態管理 ---
//  加速度の履歴（ノイズ除去・静止判定用：最新, 前, 前々, 前々々）
let hist_x = [0, 0, 0, 0]
let hist_y = [0, 0, 0, 0]
//  ボタンとタッチの最新状態
let btn_a_pressed = false
let btn_b_pressed = false
let p0_touched = false
let p1_touched = false
let p2_touched = false
//  スクロール判定用のタイムスタンプと状態
let last_touch_time = 0
let scroll_step = 0
//  0:なし, 1:P0検出, 2:P1検出(下), -1:P2検出, -2:P1検出(上)
let scroll_val = 0
//  メインループに渡すスクロール量
//  --- バックグラウンド状態監視タスク (20ms周期) ---
//  バックグラウンドタスクの起動
control.inBackground(function stuck_monitor() {
    let p0: boolean;
    let p1: boolean;
    let p2: boolean;
    let raw_x: number;
    let raw_y: number;
    let now: number;
    
    
    while (true) {
        //  1. ボタン状態の取得
        btn_a_pressed = input.buttonIsPressed(Button.A)
        btn_b_pressed = input.buttonIsPressed(Button.B)
        //  2. エッジコネクタのタッチ状態取得
        p0 = input.pinIsPressed(TouchPin.P0)
        p1 = input.pinIsPressed(TouchPin.P1)
        p2 = input.pinIsPressed(TouchPin.P2)
        //  3. 加速度センサー値の取得と履歴シフト（平行移動用）
        //  ※ロゴ右側・Aボタン正面の場合、ピッチ/ロールの傾きではなく、
        //  純粋なX/Yの瞬間的な加速度の変化（高通フィルター的な処理）で平行移動を捉えます。
        raw_x = input.acceleration(Dimension.X)
        raw_y = input.acceleration(Dimension.Y)
        hist_x.insertAt(0, raw_x)
        _py.py_array_pop(hist_x)
        hist_y.insertAt(0, raw_y)
        _py.py_array_pop(hist_y)
        //  4. エッジセンサーによるスライドスクロール判定
        //  タイムアウト処理（1秒以上経過したらリセット）
        now = control.millis()
        if (now - last_touch_time > 1000) {
            scroll_step = 0
        }
        
        //  【下スクロール判定: 0 -> 1 -> 2】
        if (p0 && scroll_step == 0) {
            scroll_step = 1
            last_touch_time = now
        } else if (p1 && scroll_step == 1) {
            scroll_step = 2
            last_touch_time = now
        } else if (p2 && scroll_step == 2) {
            scroll_val = -1
            //  下スクロール(HID側でマイナスかプラスかはOS依存、適宜調整)
            scroll_step = 0
        } else if (p2 && scroll_step == 0) {
            //  【上スクロール判定: 2 -> 1 -> 0】
            scroll_step = -1
            last_touch_time = now
        } else if (p1 && scroll_step == -1) {
            scroll_step = -2
            last_touch_time = now
        } else if (p0 && scroll_step == -2) {
            scroll_val = 1
            //  上スクロール
            scroll_step = 0
        }
        
        basic.pause(20)
    }
})
//  --- 傾き（重力）除去と移動量計算関数 ---
function calculate_movement(): any[] {
    //  履歴の差分を取ることで、持続的な重力加速度（傾き）を相殺し、
    //  手を「シュッ」と動かした時の平行移動（高周波成分）だけを抽出します。
    let diff_x = hist_x[0] - hist_x[3]
    let diff_y = hist_y[0] - hist_y[3]
    //  不感帯（デッドゾーン）の設定：小さなノイズ（手の震えなど）を無視
    if (Math.abs(diff_x) < 80) {
        diff_x = 0
    }
    
    if (Math.abs(diff_y) < 80) {
        diff_y = 0
    }
    
    //  可変速（加速）アルゴリズム
    //  ゆっくり（値が小さい）なら移動量小、速い（値が大きい）なら二次関数的に移動量大
    let move_x = Math.trunc(diff_x / 100 * (Math.abs(diff_x) / 100))
    let move_y = Math.trunc(diff_y / 100 * (Math.abs(diff_y) / 100))
    //  向きの調整（ロゴ右・A正面の座標系に合わせる。必要に応じて `-` を反転させてください）
    return [move_x, move_y]
}

//  --- メイン初期化とループ ---
//  Bluetoothマウスサービスの開始
//  (拡張機能の仕様に合わせて呼び出しています。実際のAPI名が `mouse.start_mouse_service()` である前提)
mouse.startMouseService()
while (true) {
    //  タッチロゴに触れているか確認
    if (input.logoIsPressed()) {
        //  ======= マウスモード =======
        // basic.show_icon(IconNames.SMALL_DIAMOND) # マウスモード中のインジケータ
        led.plot(0, 0)
        led.unplot(0, 4)
        //  移動量の計算
        let [mx, my] = calculate_movement()
        //  スクロール値の取得とリセット
        curr_scroll = scroll_val
        scroll_val = 0
        //  Bluetooth一括送信
        //  hold=Trueにすることで、ボタンが押されている間は「長押し維持」になります。
        //  ボタンA -> left, ボタンB -> right
        mouse.send(mx, my, btn_a_pressed, false, btn_b_pressed, curr_scroll, true)
    } else {
        //  ======= キーボードモード =======
        // basic.show_icon(IconNames.STICK_FIGURE) # キーボードモード中のインジケータ
        led.plot(0, 4)
        led.unplot(0, 0)
        //  今回は何もしないため空けておきます
        
    }
    
    basic.pause(20)
}
