/* FinFlow — Thai / English strings. Every user-visible string goes through t(); static HTML uses data-i18n attributes. */
(function (root) {
  'use strict';
  const D = {
    th: {
      app: 'FinFlow',
      greet_m: 'อรุณสวัสดิ์', greet_a: 'สวัสดีตอนบ่าย', greet_e: 'สวัสดีตอนเย็น',
      today: 'วันนี้', yesterday: 'เมื่อวาน',
      nav_home: 'หน้าหลัก', nav_scan: 'สแกน', nav_add: 'เพิ่ม', nav_analytics: 'วิเคราะห์', nav_settings: 'ตั้งค่า',
      back: 'กลับ', cancel: 'ยกเลิก', save: 'บันทึก', delete: 'ลบ', edit: 'แก้ไข', confirm: 'ยืนยัน', close: 'ปิด', ok: 'ตกลง', undo: 'เลิกทำ', add: 'เพิ่ม', skip: 'ข้าม', done: 'เสร็จสิ้น', retry: 'ลองอีกครั้ง', yes: 'ใช่', no: 'ไม่',

      /* home */
      balance: 'ยอดคงเหลือรวม', balance_sub: 'ทุกบัญชี · สะสมถึงปัจจุบัน', available: 'หลังหักเงินออม',
      income: 'รายรับ', expense: 'รายจ่าย', transfer: 'โอนย้าย', net: 'สุทธิ',
      quick: 'เมนูด่วน', q_add: 'เพิ่ม', q_scan: 'สแกนสลิป', q_goals: 'เป้าหมาย', q_analytics: 'วิเคราะห์', q_settings: 'ตั้งค่า',
      recent: 'รายการล่าสุด', see_all: 'ดูทั้งหมด',
      no_tx: 'ยังไม่มีรายการ', no_tx_sub: 'แตะ "เพิ่ม" หรือ "สแกนสลิป" เพื่อบันทึกรายการแรก',
      no_tx_month: 'เดือนนี้ยังไม่มีรายการ',
      budget: 'งบประมาณ', budget_left: 'เหลืองบ {v} เดือนนี้', budget_over: 'เกินงบ {v}', this_month: 'เดือนนี้',
      swipe_delete: 'ลบ',

      /* add / edit */
      add_title: 'เพิ่มรายการ', add_sub: 'บันทึกรายรับ รายจ่าย หรือโอนย้าย',
      edit_title: 'แก้ไขรายการ', detail_title: 'รายละเอียด',
      t_income: '+ รายรับ', t_expense: '− รายจ่าย', t_transfer: '⇄ โอนย้าย',
      amount: 'จำนวนเงิน', description: 'รายละเอียด', category: 'หมวดหมู่', date: 'วันที่', time: 'เวลา', note: 'หมายเหตุ', type: 'ประเภท',
      ph_desc: 'เช่น ข้าวกลางวัน, เงินเดือน...', ph_note: 'บันทึกเพิ่มเติม (ไม่บังคับ)',
      account: 'บัญชี', from_acct: 'จากบัญชี', to_acct: 'เข้าบัญชี', acct_external: 'บัญชีอื่นของฉัน (ไม่ติดตาม)', payee: 'ผู้รับ',
      save_tx: 'บันทึกรายการ', save_changes: 'บันทึกการแก้ไข',
      fill_all: 'กรุณากรอกจำนวนเงิน รายละเอียด และวันที่ให้ครบ', bad_amount: 'จำนวนเงินไม่ถูกต้อง', bad_date: 'วันที่ไม่ถูกต้อง',
      future_date: 'วันที่นี้อยู่ในอนาคต ({d}) บันทึกต่อไหม?', saved: 'บันทึกแล้ว', deleted: 'ลบแล้ว', updated: 'แก้ไขแล้ว',
      dup_warn: 'มีรายการที่ดูเหมือนกันอยู่แล้ว: {n} {a} ({d} {t}) บันทึกซ้ำไหม?', dup_title: 'อาจซ้ำ',
      confirm_delete: 'ลบรายการนี้?', from_slip: 'จากสลิป', transfer_cat: 'โอนย้ายระหว่างบัญชี',
      same_acct: 'บัญชีต้นทางและปลายทางต้องต่างกัน',

      /* scan */
      scan_title: 'สแกนสลิป', scan_sub: 'อ่านจำนวนเงิน วันที่ เวลา ผู้รับ ในเครื่องของคุณ ไม่ส่งรูปออกไปไหน',
      upload_title: 'แตะเพื่อเลือกสลิป (เลือกได้หลายรูป)', upload_sub: 'KBank Make · สลิปธนาคารอื่นก็ลองได้ · อ่านในเครื่อง',
      scan_loading: 'กำลังเตรียมระบบอ่านสลิป (ครั้งแรกใช้เวลาสักครู่)...',
      scan_loading_fail: 'โหลดระบบอ่านสลิปไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ (ครั้งแรกต้องออนไลน์)',
      scan_reading: 'กำลังอ่านสลิป {i}/{n}...', scan_step: 'ขั้นตอน: {s}',
      s_prepare: 'เตรียมภาพ', s_layout: 'หาตำแหน่งข้อความ', s_amount: 'อ่านจำนวนเงิน', s_date: 'อ่านวันที่/เวลา', s_names: 'อ่านชื่อ', s_note: 'อ่านโน้ต', s_verify: 'ตรวจสอบซ้ำ',
      scan_queue: 'รายการที่สแกน', scan_empty: 'เลือกรูปสลิปเพื่อเริ่ม',
      st_wait: 'รอคิว', st_read: 'กำลังอ่าน...', st_ready: 'พร้อมบันทึก', st_check: 'โปรดตรวจ', st_dup: 'อาจซ้ำ', st_saved: 'บันทึกแล้ว', st_err: 'อ่านไม่ได้', st_skip: 'ข้ามแล้ว',
      save_all: 'บันทึกที่พร้อมทั้งหมด ({n})', save_one: 'บันทึก', skip_one: 'ข้าม', scan_more: 'สแกนเพิ่ม',
      sc_amount: 'จำนวนเงิน', sc_date: 'วันที่', sc_time: 'เวลา', sc_to: 'ผู้รับ', sc_desc: 'รายละเอียด', sc_note: 'โน้ตจากสลิป', sc_cat: 'หมวดหมู่',
      flag_check: 'ตรวจ', flag_ok: 'ยืนยันแล้ว',
      f_amount_disagree: 'อ่านจำนวนเงินได้ไม่ตรงกัน 2 รอบ — ตรวจกับสลิป',
      f_amount_missing: 'อ่านจำนวนเงินไม่ได้ — กรอกเอง',
      f_date_missing: 'อ่านวันที่ไม่ได้ — เลือกวันที่เอง',
      f_date_disagree: 'วันที่จากข้อความกับเลขที่รายการไม่ตรงกัน — ตรวจกับสลิป',
      f_date_future: 'วันที่อยู่ในอนาคต — ตรวจกับสลิป',
      f_time_missing: 'อ่านเวลาไม่ได้',
      f_name_low: 'ชื่ออ่านได้ไม่ชัด — ตรวจ/แก้ไข',
      f_note_low: 'โน้ตอ่านได้ไม่ชัด — ตรวจ/แก้ไข',
      f_dup_certain: 'สลิปนี้เคยบันทึกแล้ว (เลขที่รายการเดียวกัน)',
      f_dup_prob: 'มีรายการจำนวน/วัน/เวลาเดียวกันอยู่แล้ว',
      f_own: 'ดูเหมือนโอนระหว่างบัญชีของคุณเอง — ตั้งเป็น "โอนย้าย"',
      f_learned: 'จำจากที่คุณเคยแก้ไว้',
      f_name_first: 'ผู้รับใหม่ — อ่านชื่อจากสลิป ตรวจ/แก้ไขได้ (ครั้งหน้าจำให้อัตโนมัติ)',
      f_layout: 'รูปแบบสลิปไม่คุ้นเคย — ตรวจทุกช่อง',
      kind_transfer: 'โอนเงิน', kind_pay: 'ชำระเงิน', kind_topup: 'เติมเงิน', kind_receive: 'รับเงิน',
      scan_tip1: 'ใช้รูปสลิปที่บันทึกจากแอปธนาคาร (ไม่ครอป ไม่ย่อ)', scan_tip2: 'แอปจะจำชื่อผู้รับและหมวดที่คุณแก้ไว้ — ครั้งต่อไปอัตโนมัติ', scan_tip3: 'ตรวจช่องที่มีเครื่องหมายเตือนก่อนบันทึกเสมอ', tips: 'เคล็ดลับ',
      scan_attach: 'แนบภาพสลิปกับรายการ', scan_attach_sub: 'เก็บภาพย่อของสลิปไว้ดูภายหลัง (ในเครื่องเท่านั้น ไม่รวมในไฟล์สำรอง)',

      /* all tx */
      all_title: 'รายการทั้งหมด', search_ph: 'ค้นหาชื่อ หมวด หมายเหตุ...', f_all: 'ทั้งหมด', f_income: 'รายรับ', f_expense: 'รายจ่าย', f_transfer: 'โอนย้าย',
      scope_month: 'เดือนนี้', scope_all: 'ทุกเดือน', filter_day: 'กรองตามวัน', min_ph: 'ต่ำสุด ฿', max_ph: 'สูงสุด ฿', clear_filters: 'ล้าง',
      no_results: 'ไม่พบรายการ', items: '{n} รายการ', in_out: 'รับ {i} · จ่าย {o}',

      /* analytics */
      an_title: 'วิเคราะห์', an_sub: 'สรุปการใช้จ่ายของคุณ',
      total_spent: 'รายจ่ายรวม', vs_last: 'เทียบเดือนก่อน', savings_rate: 'อัตราการออม', avg_day: 'เฉลี่ย/วัน', biggest: 'จ่ายสูงสุด', tx_count: 'จำนวนรายการ',
      all_net: 'ยอดสะสมทั้งหมด', all_records: 'รายการทั้งหมด',
      c_donut: 'รายจ่ายตามหมวดหมู่', c_donut_sub: 'สรุปของเดือนที่เลือก', c_bar: 'แนวโน้มรายจ่าย', c_bar_sub: '6 เดือนล่าสุด',
      c_line: 'รายรับเทียบรายจ่าย', c_line_sub: '6 เดือนล่าสุด', c_nw: 'แนวโน้มยอดเงิน', c_nw_sub: 'ยอดสะสม 6 เดือนล่าสุด',
      c_heat: 'ปฏิทินการใช้จ่าย', c_heat_sub: 'สีเข้ม = ใช้จ่ายมาก', c_top: 'หมวดหมู่สูงสุด', c_top_sub: 'ตามยอดเงินของเดือนที่เลือก',
      out: 'จ่าย', in: 'รับ', no_data: 'ไม่มีข้อมูล', no_exp_month: 'เดือนนี้ไม่มีรายจ่าย', no_inc_month: 'เดือนนี้ไม่มีรายรับ',
      budget_card: 'งบประมาณรายเดือน', budget_card_sub: 'ยอดใช้จ่าย เทียบกับงบ', over_by: 'เกินงบ {v}', remaining_pct: 'เหลืองบอีก {p}%',
      cat_budgets: 'งบตามหมวดหมู่', open_report: 'ดูรายงานสรุป', higher: 'สูงกว่า', lower: 'ต่ำกว่า', day_n: 'วันที่ {d}',
      other_cats: 'อื่นๆ',

      /* report */
      report_title: 'รายงานสรุป', report_sub: 'สรุปรายเดือนและรายปี', r_month: 'รายเดือน', r_year: 'รายปี', print: 'พิมพ์ / บันทึกเป็น PDF',
      r_summary: 'สรุป', r_by_cat: 'ตามหมวดหมู่', r_top: 'รายจ่ายสูงสุด 5 อันดับ', r_by_month: 'รายเดือน', r_pct: 'สัดส่วน', r_generated: 'สร้างเมื่อ {d}',

      /* settings */
      set_title: 'ตั้งค่า', set_sub: 'การตั้งค่าและข้อมูล',
      s_language: 'ภาษา', s_appearance: 'รูปแบบ', s_security: 'ความปลอดภัย', s_budget: 'งบประมาณ', s_money: 'การเงิน', s_data: 'ข้อมูล', s_about: 'เกี่ยวกับ', s_notify: 'การแจ้งเตือน',
      dark_mode: 'โหมดมืด', dark_mode_sub: 'สลับโหมดมืด / สว่าง',
      pin_lock: 'PIN Lock', pin_lock_sub: 'ล็อกแอปด้วย PIN 4 หลัก (กันคนอื่นแอบดู ไม่ใช่การเข้ารหัส)',
      pin_autolock: 'ล็อกอัตโนมัติ', pin_autolock_sub: 'เมื่อออกจากแอปเกิน 30 วินาที',
      budget_total: 'วงเงินใช้จ่ายต่อเดือน', budget_total_sub: 'แสดงความคืบหน้าในหน้าหลักและวิเคราะห์', budget_by_cat: 'งบตามหมวดหมู่', budget_by_cat_sub: 'ตั้งวงเงินแยกแต่ละหมวด',
      accounts: 'บัญชี / กระเป๋าเงิน', accounts_sub: 'เงินสด ธนาคาร บัตรเครดิต พร้อมยอดเริ่มต้น',
      recurring: 'รายการประจำ', recurring_sub: 'เพิ่มอัตโนมัติ เช่น เงินเดือน ค่าเช่า',
      categories: 'หมวดหมู่', categories_sub: 'เพิ่ม แก้ไข ลบ', goals: 'เป้าหมายการออม', goals_sub: 'ตั้งเป้าและติดตามความคืบหน้า',
      notif: 'แจ้งเตือนงบประมาณ', notif_sub: 'เตือนเมื่อใช้จ่ายถึง 80% และเกินงบ (ต้องอนุญาตการแจ้งเตือน)',
      backup: 'สำรองข้อมูล', backup_sub: 'ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON', backup_share: 'ส่งไฟล์สำรอง', backup_share_sub: 'บันทึกลง Files / ส่งเข้า LINE, อีเมล',
      restore: 'กู้คืนจากไฟล์สำรอง', restore_sub: 'เลือกไฟล์ JSON ของ FinFlow',
      export_csv: 'ส่งออก CSV', export_csv_sub: 'เปิดใน Excel / Google Sheets',
      undo_clear: 'ย้อนกลับข้อมูลก่อนหน้า', undo_clear_sub: 'กู้ข้อมูลจากก่อนล้าง/กู้คืนล่าสุด',
      clear_all: 'ลบข้อมูลทั้งหมด', clear_all_sub: 'ลบทุกอย่างในเครื่องนี้ (สำรองอัตโนมัติไว้ย้อนกลับได้)',
      storage: 'พื้นที่จัดเก็บ', storage_sub: '{u} ใช้ไป · ข้อมูล{p}', persist_yes: 'ถูกป้องกันจากการล้างอัตโนมัติ', persist_no: 'ยังไม่ถูกป้องกันจากการล้างอัตโนมัติ — สำรองข้อมูลสม่ำเสมอ',
      last_backup: 'สำรองล่าสุด', never: 'ยังไม่เคย', check_update: 'ตรวจหาเวอร์ชันใหม่', check_update_sub: 'โหลดเวอร์ชันล่าสุดจาก GitHub',
      version: 'เวอร์ชัน {v} · ใช้งานส่วนตัว', privacy: 'ข้อมูลเป็นส่วนตัว 100%', privacy_sub: 'เก็บในเครื่องนี้เท่านั้น ไม่มีเซิร์ฟเวอร์ ไม่มีบัญชี ภาพสลิปไม่ถูกส่งออก',
      backup_done: 'ดาวน์โหลดไฟล์สำรองแล้ว', restore_done: 'กู้คืนข้อมูลแล้ว ({n} รายการ)', restore_err: 'ไฟล์สำรองไม่ถูกต้อง',
      restore_confirm: 'แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรองนี้ ({n} รายการ)? ระบบจะสำรองข้อมูลปัจจุบันไว้ให้ย้อนกลับได้', restore_dropped: 'ข้ามรายการที่ไม่ถูกต้อง {n} รายการ',
      clear_confirm: 'ลบข้อมูลทั้งหมดในเครื่องนี้? (ย้อนกลับได้จากเมนู "ย้อนกลับข้อมูลก่อนหน้า")', cleared: 'ลบข้อมูลทั้งหมดแล้ว', nothing_to_undo: 'ไม่มีข้อมูลให้ย้อนกลับ', undo_confirm: 'ย้อนกลับไปข้อมูลเมื่อ {d} ({n} รายการ)?',
      csv_done: 'ดาวน์โหลด CSV แล้ว', backup_reminder: 'ยังไม่ได้สำรองข้อมูลมา {n} วันแล้ว — แตะเพื่อสำรอง', backup_reminder_never: 'ยังไม่เคยสำรองข้อมูล — แตะเพื่อสำรองตอนนี้',
      update_none: 'เป็นเวอร์ชันล่าสุดแล้ว', update_found: 'พบเวอร์ชันใหม่ กำลังรีโหลด...', update_fail: 'ตรวจเวอร์ชันไม่สำเร็จ (ออฟไลน์?)', offline_ready: 'พร้อมใช้งานออฟไลน์',
      storage_full: 'พื้นที่เก็บข้อมูลเต็ม บันทึกไม่สำเร็จ — สำรองข้อมูลแล้วลบรายการเก่า',

      /* PIN */
      pin_enter: 'ใส่ PIN', pin_set: 'ตั้ง PIN ใหม่ (4 ตัวเลข)', pin_confirm: 'ยืนยัน PIN อีกครั้ง', pin_wrong: 'PIN ไม่ถูกต้อง', pin_mismatch: 'PIN ไม่ตรงกัน ลองใหม่',
      pin_set_ok: 'ตั้ง PIN แล้ว', pin_off_confirm: 'ปิด PIN lock?', pin_off_ok: 'ปิด PIN แล้ว', pin_locked: 'ลองผิดหลายครั้ง รออีก {s} วินาที', pin_cancel: 'ยกเลิก',

      /* categories */
      cats_title: 'หมวดหมู่', cats_sub: 'จัดการรายการหมวดหมู่', cats_exp: 'หมวดหมู่รายจ่าย', cats_inc: 'หมวดหมู่รายรับ', add_cat: '+ เพิ่มหมวดหมู่', cat_name: 'ชื่อหมวดหมู่', cat_emoji: 'อีโมจิ',
      cat_add_title: 'เพิ่มหมวดหมู่', cat_edit_title: 'แก้ไขหมวดหมู่', cat_exists: 'มีหมวดหมู่ชื่อนี้อยู่แล้ว', cat_bad_char: 'ชื่อหมวดห้ามมีเครื่องหมาย |',
      cat_delete_confirm: 'ลบหมวด "{c}"? ({n} รายการที่ใช้หมวดนี้จะยังอยู่ แต่หมวดจะไม่อยู่ในรายการเลือก)', cat_rename_note: 'การเปลี่ยนชื่อจะอัปเดตทุกรายการที่ใช้หมวดนี้',
      cat_last: 'ต้องเหลืออย่างน้อย 1 หมวดหมู่',

      /* accounts */
      acct_title: 'บัญชี / กระเป๋า', acct_sub: 'ยอดเงินแยกตามบัญชี', acct_add: '+ เพิ่มบัญชี', acct_name: 'ชื่อบัญชี', acct_opening: 'ยอดเริ่มต้น', acct_main: 'บัญชีหลัก',
      acct_add_title: 'เพิ่มบัญชี', acct_edit_title: 'แก้ไขบัญชี', acct_in_use: 'บัญชีนี้มีรายการอยู่ ลบไม่ได้ (แก้ชื่อได้)', acct_delete_confirm: 'ลบบัญชี "{n}"?', acct_info: 'ถ้ามีบัญชีเดียว แอปทำงานเหมือนเดิม เพิ่มบัญชีเมื่ออยากแยกเงินสด/ธนาคาร/บัตร ยอดรวมคือผลรวมทุกบัญชี',
      acct_balance: 'ยอดคงเหลือ',

      /* recurring */
      rec_title: 'รายการประจำ', rec_sub: 'เพิ่มอัตโนมัติทุกเดือน', rec_add: '+ เพิ่มรายการประจำ', rec_add_title: 'เพิ่มรายการประจำ', rec_edit_title: 'แก้ไขรายการประจำ',
      rec_day: 'วันที่ของเดือน (1–31)', rec_every: 'ทุกวันที่ {d}', rec_info: 'เมื่อเปิดแอป ระบบจะเพิ่มรายการของเดือนนี้และเดือนที่ข้ามไปให้อัตโนมัติ (ไม่เพิ่มซ้ำแม้คุณลบรายการนั้นไปแล้ว) วันที่ 29–31 จะใช้วันสุดท้ายของเดือนที่สั้นกว่า',
      rec_empty: 'ยังไม่มีรายการประจำ', rec_empty_sub: 'เพิ่มเงินเดือน ค่าเช่า หรือค่าสมัครสมาชิก', rec_added: 'เพิ่มรายการประจำ {n} รายการ', rec_now: 'เพิ่มตอนนี้', rec_delete_confirm: 'ลบรายการประจำนี้?', rec_start: 'เริ่มตั้งแต่', rec_added_now: 'เพิ่มแล้ว: {n}',

      /* goals */
      goals_title: 'เป้าหมายการออม', goals_sub: 'ติดตามเป้าหมายของคุณ', goal_add: '+ เพิ่มเป้าหมาย', goal_add_title: 'เพิ่มเป้าหมาย', goal_edit_title: 'แก้ไขเป้าหมาย', goal_name: 'ชื่อเป้าหมาย (เช่น โน้ตบุ๊กใหม่)', goal_target: 'จำนวนเงินเป้าหมาย',
      goal_empty: 'ยังไม่มีเป้าหมาย', goal_empty_sub: 'ตั้งเป้าหมายการออมของคุณ', goal_pct: 'สำเร็จ {p}%', goal_togo: 'อีก {v}', goal_reached: 'ถึงเป้าหมายแล้ว!', goal_contrib: '+ ออมเพิ่ม', goal_withdraw: 'ถอน',
      goal_save_to: 'ออมไปที่: {n}', goal_withdraw_from: 'ถอนจาก: {n}', goal_amount: 'จำนวนเงิน', goal_delete_confirm: 'ลบเป้าหมายนี้?', goal_note: 'เงินออมในเป้าหมายยังอยู่ในยอดคงเหลือ แต่ถูกหักออกจาก "หลังหักเงินออม" บนหน้าหลัก', goal_saved: 'บันทึกเงินออมแล้ว', goal_over: 'ถอนเกินที่ออมไว้ไม่ได้', goal_total_saved: 'เงินออมในเป้าหมายรวม',

      /* budgets page */
      bud_title: 'งบตามหมวดหมู่', bud_sub: 'กำหนดวงเงินต่อเดือนของแต่ละหมวด', bud_hint: 'เว้นว่างหรือ 0 = ไม่จำกัด', bud_saved: 'บันทึกงบแล้ว',
      bud_alert80: 'ใช้งบ "{c}" ไป {p}% แล้ว', bud_alert100: 'เกินงบ "{c}" แล้ว', bud_total80: 'ใช้งบรายเดือนไป {p}% แล้ว', bud_total100: 'เกินงบรายเดือนแล้ว',
      notif_denied: 'เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน (ยังเห็นเตือนในแอป)',

      /* misc */
      install_hint: 'ติดตั้งลงหน้าจอโฮม: แตะแชร์ → "เพิ่มลงหน้าจอโฮม" เพื่อใช้งานออฟไลน์และข้อมูลไม่ถูกล้าง',
      months_short: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
      months_long: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
      wd_short: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'], wd_long: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
      error_generic: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
    },
    en: {
      app: 'FinFlow',
      greet_m: 'Good morning', greet_a: 'Good afternoon', greet_e: 'Good evening',
      today: 'Today', yesterday: 'Yesterday',
      nav_home: 'Home', nav_scan: 'Scan', nav_add: 'Add', nav_analytics: 'Analytics', nav_settings: 'Settings',
      back: 'Back', cancel: 'Cancel', save: 'Save', delete: 'Delete', edit: 'Edit', confirm: 'Confirm', close: 'Close', ok: 'OK', undo: 'Undo', add: 'Add', skip: 'Skip', done: 'Done', retry: 'Retry', yes: 'Yes', no: 'No',

      balance: 'Total balance', balance_sub: 'All accounts · cumulative to date', available: 'After savings goals',
      income: 'Income', expense: 'Expense', transfer: 'Transfer', net: 'Net',
      quick: 'Quick actions', q_add: 'Add', q_scan: 'Scan slip', q_goals: 'Goals', q_analytics: 'Analytics', q_settings: 'Settings',
      recent: 'Recent transactions', see_all: 'See all',
      no_tx: 'No transactions yet', no_tx_sub: 'Tap "Add" or "Scan slip" to record your first one',
      no_tx_month: 'No transactions this month',
      budget: 'Budget', budget_left: '{v} budget left this month', budget_over: 'Over budget by {v}', this_month: 'this month',
      swipe_delete: 'Delete',

      add_title: 'Add transaction', add_sub: 'Record income, expense or a transfer',
      edit_title: 'Edit transaction', detail_title: 'Details',
      t_income: '+ Income', t_expense: '− Expense', t_transfer: '⇄ Transfer',
      amount: 'Amount', description: 'Description', category: 'Category', date: 'Date', time: 'Time', note: 'Note', type: 'Type',
      ph_desc: 'e.g. Lunch, Salary...', ph_note: 'Optional note / memo',
      account: 'Account', from_acct: 'From account', to_acct: 'To account', acct_external: 'My other account (not tracked)', payee: 'Payee',
      save_tx: 'Save transaction', save_changes: 'Save changes',
      fill_all: 'Please enter amount, description and date', bad_amount: 'Invalid amount', bad_date: 'Invalid date',
      future_date: 'This date is in the future ({d}). Save anyway?', saved: 'Saved', deleted: 'Deleted', updated: 'Updated',
      dup_warn: 'A similar transaction already exists: {n} {a} ({d} {t}). Save a duplicate?', dup_title: 'Possible duplicate',
      confirm_delete: 'Delete this transaction?', from_slip: 'From slip', transfer_cat: 'Transfer between accounts',
      same_acct: 'Source and destination accounts must differ',

      scan_title: 'Scan slip', scan_sub: 'Reads amount, date, time and payee on your device. Images never leave your phone.',
      upload_title: 'Tap to choose slips (multiple allowed)', upload_sub: 'KBank Make · other banks may work · read on-device',
      scan_loading: 'Preparing the slip reader (first run takes a moment)...',
      scan_loading_fail: 'Could not load the slip reader. Check your connection and retry (first run needs internet).',
      scan_reading: 'Reading slip {i}/{n}...', scan_step: 'Step: {s}',
      s_prepare: 'Preparing image', s_layout: 'Finding text', s_amount: 'Reading amount', s_date: 'Reading date/time', s_names: 'Reading names', s_note: 'Reading note', s_verify: 'Double-checking',
      scan_queue: 'Scanned items', scan_empty: 'Choose slip images to begin',
      st_wait: 'Queued', st_read: 'Reading...', st_ready: 'Ready', st_check: 'Please check', st_dup: 'Possible duplicate', st_saved: 'Saved', st_err: 'Could not read', st_skip: 'Skipped',
      save_all: 'Save all ready ({n})', save_one: 'Save', skip_one: 'Skip', scan_more: 'Scan more',
      sc_amount: 'Amount', sc_date: 'Date', sc_time: 'Time', sc_to: 'Payee', sc_desc: 'Description', sc_note: 'Slip note', sc_cat: 'Category',
      flag_check: 'Check', flag_ok: 'Verified',
      f_amount_disagree: 'Two reads of the amount disagree — check against the slip',
      f_amount_missing: 'Amount not found — enter it manually',
      f_date_missing: 'Date not found — pick it manually',
      f_date_disagree: 'Date text and transaction number disagree — check the slip',
      f_date_future: 'Date is in the future — check the slip',
      f_time_missing: 'Time not found',
      f_name_low: 'Name is unclear — check / edit',
      f_note_low: 'Note is unclear — check / edit',
      f_dup_certain: 'This slip was already saved (same transaction number)',
      f_dup_prob: 'A transaction with the same amount/date/time exists',
      f_own: 'Looks like a transfer between your own accounts — set to "Transfer"',
      f_learned: 'Remembered from your earlier edit',
      f_name_first: 'New payee — name read from the slip, check/edit (remembered next time)',
      f_layout: 'Unfamiliar slip layout — check every field',
      kind_transfer: 'Transfer', kind_pay: 'Payment', kind_topup: 'Top-up', kind_receive: 'Received',
      scan_tip1: 'Use the slip image saved from your bank app (uncropped)', scan_tip2: 'The app remembers payees and categories you correct — automatic next time', scan_tip3: 'Always check fields marked with a warning before saving', tips: 'Tips',
      scan_attach: 'Attach slip image to transaction', scan_attach_sub: 'Keep a small thumbnail of the slip (stored on this device only, not included in backups)',

      all_title: 'All transactions', search_ph: 'Search name, category, note...', f_all: 'All', f_income: 'Income', f_expense: 'Expense', f_transfer: 'Transfer',
      scope_month: 'This month', scope_all: 'All months', filter_day: 'Filter by day', min_ph: 'Min ฿', max_ph: 'Max ฿', clear_filters: 'Clear',
      no_results: 'No results found', items: '{n} items', in_out: 'In {i} · Out {o}',

      an_title: 'Analytics', an_sub: 'Your spending insights',
      total_spent: 'Total spent', vs_last: 'vs last month', savings_rate: 'Savings rate', avg_day: 'Avg / day', biggest: 'Biggest expense', tx_count: 'Transactions',
      all_net: 'All-time net', all_records: 'Total records',
      c_donut: 'Spending by category', c_donut_sub: 'Selected month', c_bar: 'Spending trend', c_bar_sub: 'Last 6 months',
      c_line: 'Income vs expense', c_line_sub: 'Last 6 months', c_nw: 'Balance trend', c_nw_sub: 'Running balance, last 6 months',
      c_heat: 'Daily spending', c_heat_sub: 'Darker = more spent', c_top: 'Top categories', c_top_sub: 'By amount, selected month',
      out: 'Out', in: 'In', no_data: 'No data', no_exp_month: 'No expenses this month', no_inc_month: 'No income this month',
      budget_card: 'Monthly budget', budget_card_sub: 'Spending vs target', over_by: 'Over budget by {v}', remaining_pct: '{p}% of budget remaining',
      cat_budgets: 'Category budgets', open_report: 'Open summary report', higher: 'higher', lower: 'lower', day_n: 'Day {d}',
      other_cats: 'Other',

      report_title: 'Summary report', report_sub: 'Monthly and yearly summary', r_month: 'Monthly', r_year: 'Yearly', print: 'Print / Save as PDF',
      r_summary: 'Summary', r_by_cat: 'By category', r_top: 'Top 5 expenses', r_by_month: 'By month', r_pct: 'Share', r_generated: 'Generated {d}',

      set_title: 'Settings', set_sub: 'Preferences & data',
      s_language: 'Language', s_appearance: 'Appearance', s_security: 'Security', s_budget: 'Budget', s_money: 'Money', s_data: 'Data', s_about: 'About', s_notify: 'Notifications',
      dark_mode: 'Dark mode', dark_mode_sub: 'Toggle dark / light theme',
      pin_lock: 'PIN Lock', pin_lock_sub: 'Lock the app with a 4-digit PIN (keeps others from peeking; it is not encryption)',
      pin_autolock: 'Auto-lock', pin_autolock_sub: 'After leaving the app for 30 seconds',
      budget_total: 'Monthly spending limit', budget_total_sub: 'Progress is shown on Home and Analytics', budget_by_cat: 'Category budgets', budget_by_cat_sub: 'Set a limit for each category',
      accounts: 'Accounts / wallets', accounts_sub: 'Cash, bank, credit card with opening balance',
      recurring: 'Recurring', recurring_sub: 'Auto-add salary, rent, bills',
      categories: 'Categories', categories_sub: 'Add, edit, delete', goals: 'Savings goals', goals_sub: 'Set targets and track progress',
      notif: 'Budget alerts', notif_sub: 'Notify at 80% and when over budget (needs notification permission)',
      backup: 'Back up data', backup_sub: 'Download everything as a JSON file', backup_share: 'Share backup file', backup_share_sub: 'Save to Files / send via LINE, email',
      restore: 'Restore from backup', restore_sub: 'Choose a FinFlow JSON file',
      export_csv: 'Export CSV', export_csv_sub: 'Open in Excel / Google Sheets',
      undo_clear: 'Undo last wipe / restore', undo_clear_sub: 'Recover data from before the last clear or restore',
      clear_all: 'Clear all data', clear_all_sub: 'Erase everything on this device (an automatic snapshot lets you undo)',
      storage: 'Storage', storage_sub: '{u} used · data {p}', persist_yes: 'protected from automatic clearing', persist_no: 'not protected from automatic clearing — back up regularly',
      last_backup: 'Last backup', never: 'never', check_update: 'Check for updates', check_update_sub: 'Load the latest version from GitHub',
      version: 'Version {v} · Personal use', privacy: '100% private', privacy_sub: 'Stored on this device only. No server, no account, slip images are never uploaded.',
      backup_done: 'Backup downloaded', restore_done: 'Restored ({n} transactions)', restore_err: 'Invalid backup file',
      restore_confirm: 'Replace current data with this backup ({n} transactions)? Current data is snapshotted so you can undo.', restore_dropped: 'Skipped {n} invalid records',
      clear_confirm: 'Erase ALL data on this device? (You can undo from "Undo last wipe / restore")', cleared: 'All data cleared', nothing_to_undo: 'Nothing to undo', undo_confirm: 'Go back to data from {d} ({n} transactions)?',
      csv_done: 'CSV downloaded', backup_reminder: 'No backup for {n} days — tap to back up', backup_reminder_never: 'You have never backed up — tap to back up now',
      update_none: 'You have the latest version', update_found: 'New version found, reloading...', update_fail: 'Could not check for updates (offline?)', offline_ready: 'Ready to use offline',
      storage_full: 'Storage is full and the save failed — back up, then delete old records',

      pin_enter: 'Enter PIN', pin_set: 'Set a new PIN (4 digits)', pin_confirm: 'Confirm PIN', pin_wrong: 'Wrong PIN', pin_mismatch: "PINs don't match, try again",
      pin_set_ok: 'PIN set', pin_off_confirm: 'Disable PIN lock?', pin_off_ok: 'PIN disabled', pin_locked: 'Too many attempts. Wait {s}s', pin_cancel: 'Cancel',

      cats_title: 'Categories', cats_sub: 'Manage your lists', cats_exp: 'Expense categories', cats_inc: 'Income categories', add_cat: '+ Add category', cat_name: 'Category name', cat_emoji: 'Emoji',
      cat_add_title: 'Add category', cat_edit_title: 'Edit category', cat_exists: 'A category with this name already exists', cat_bad_char: 'Category names cannot contain "|"',
      cat_delete_confirm: 'Delete "{c}"? ({n} transactions keep this category name but it will leave the picker)', cat_rename_note: 'Renaming updates every transaction that uses this category',
      cat_last: 'At least one category must remain',

      acct_title: 'Accounts / wallets', acct_sub: 'Balances per account', acct_add: '+ Add account', acct_name: 'Account name', acct_opening: 'Opening balance', acct_main: 'Main account',
      acct_add_title: 'Add account', acct_edit_title: 'Edit account', acct_in_use: 'This account has transactions and cannot be deleted (you can rename it)', acct_delete_confirm: 'Delete account "{n}"?', acct_info: 'With a single account the app works as before. Add accounts to separate cash / bank / cards. The total is the sum of all accounts.',
      acct_balance: 'Balance',

      rec_title: 'Recurring', rec_sub: 'Auto-add monthly transactions', rec_add: '+ Add recurring', rec_add_title: 'Add recurring', rec_edit_title: 'Edit recurring',
      rec_day: 'Day of month (1–31)', rec_every: 'Every {d}', rec_info: 'When you open the app, this month’s items (and any months you skipped) are added automatically — never twice, even if you delete one. Days 29–31 use the last day of shorter months.',
      rec_empty: 'No recurring items', rec_empty_sub: 'Add salary, rent, subscriptions', rec_added: '{n} recurring added', rec_now: 'Add now', rec_delete_confirm: 'Delete this recurring item?', rec_start: 'Starts', rec_added_now: 'Added: {n}',

      goals_title: 'Savings goals', goals_sub: 'Track your targets', goal_add: '+ Add goal', goal_add_title: 'Add goal', goal_edit_title: 'Edit goal', goal_name: 'Goal name (e.g. New laptop)', goal_target: 'Target amount',
      goal_empty: 'No goals yet', goal_empty_sub: 'Set a target and track your progress', goal_pct: '{p}% complete', goal_togo: '{v} to go', goal_reached: 'Goal reached!', goal_contrib: '+ Add savings', goal_withdraw: 'Withdraw',
      goal_save_to: 'Save towards: {n}', goal_withdraw_from: 'Withdraw from: {n}', goal_amount: 'Amount', goal_delete_confirm: 'Delete this goal?', goal_note: 'Goal savings stay in your balance but are subtracted in "After savings goals" on Home', goal_saved: 'Savings recorded', goal_over: 'Cannot withdraw more than saved', goal_total_saved: 'Total saved in goals',

      bud_title: 'Category budgets', bud_sub: 'Monthly limit for each category', bud_hint: 'Empty or 0 = no limit', bud_saved: 'Budgets saved',
      bud_alert80: 'You have used {p}% of your "{c}" budget', bud_alert100: 'You are over your "{c}" budget', bud_total80: 'You have used {p}% of your monthly budget', bud_total100: 'You are over your monthly budget',
      notif_denied: 'Notifications are blocked by the browser (in-app alerts still work)',

      install_hint: 'Install to Home Screen: tap Share → "Add to Home Screen" for offline use and safer storage.',
      months_short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      months_long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      wd_short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], wd_long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      error_generic: 'Something went wrong. Please try again.'
    }
  };

  /* Built-in category names are stored in English (v1–v3 data). Show them in Thai when the UI is Thai. */
  const CAT_TH = { Food: 'อาหาร', Transport: 'เดินทาง', Health: 'สุขภาพ', Shopping: 'ช้อปปิ้ง', Rent: 'ที่พัก', Entertainment: 'บันเทิง', Bills: 'บิล/ค่าใช้จ่าย', Travel: 'ท่องเที่ยว', Other: 'อื่นๆ', Investment: 'ลงทุน', Salary: 'เงินเดือน', Freelance: 'ฟรีแลนซ์', Bonus: 'โบนัส', 'Other income': 'รายรับอื่นๆ' };

  let lang = 'th';
  function t(key, vars) {
    let s = (D[lang] && D[lang][key] !== undefined) ? D[lang][key] : (D.en[key] !== undefined ? D.en[key] : key);
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '{' + k + '}'));
    return s;
  }
  function catLabel(name) { return lang === 'th' && CAT_TH[name] ? CAT_TH[name] : name; }
  function setLang(l) { lang = l === 'en' ? 'en' : 'th'; try { document.documentElement.lang = lang; } catch (_) { } }
  function getLang() { return lang; }
  /** Translate static HTML: data-i18n (textContent), data-i18n-ph (placeholder), data-i18n-title (aria-label/title). */
  function apply(rootEl) {
    const r = rootEl || document;
    r.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.getAttribute('data-i18n')); });
    r.querySelectorAll('[data-i18n-ph]').forEach(e => { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
    r.querySelectorAll('[data-i18n-title]').forEach(e => { const v = t(e.getAttribute('data-i18n-title')); e.setAttribute('title', v); e.setAttribute('aria-label', v); });
  }
  /** "30 ก.ย. 2569" in Thai (Buddhist year) or "30 Sep 2026" in English. `ds` = YYYY-MM-DD. */
  function dateLabel(ds, opt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || ''); if (!m) return '';
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const mn = t(opt && opt.long ? 'months_long' : 'months_short')[mo];
    const yy = lang === 'th' ? y + 543 : y;
    if (opt && opt.noYear) return d + ' ' + mn;
    return d + ' ' + mn + ' ' + yy;
  }
  function weekday(ds, long) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || ''); if (!m) return ''; const w = new Date(+m[1], +m[2] - 1, +m[3]).getDay(); return t(long ? 'wd_long' : 'wd_short')[w]; }
  function monthLabel(y, m) { return t('months_short')[m] + ' ' + (lang === 'th' ? y + 543 : y); }
  function monthLabelLong(y, m) { return t('months_long')[m] + ' ' + (lang === 'th' ? y + 543 : y); }

  const I = { t, catLabel, setLang, getLang, apply, dateLabel, weekday, monthLabel, monthLabelLong, _D: D };
  if (typeof module !== 'undefined' && module.exports) module.exports = I;
  root.I18N = I; root.t = t;
})(typeof window !== 'undefined' ? window : globalThis);
