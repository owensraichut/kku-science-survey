// ====================================================================
// SUPABASE CONFIGURATION FILE
// ====================================================================
// กำหนดค่าการเชื่อมต่อฐานข้อมูล Supabase ที่นี่
// หากยังไม่มีคีย์ สามารถปล่อยว่างไว้เพื่อทดลองใช้ระบบในโหมด LocalStorage (Demo) ได้ทันที

const SUPABASE_CONFIG = {
    // 1. ใส่ URL ของโครงการ Supabase ของคุณ (ตัวอย่าง: 'https://xyzabcdefg.supabase.co')
    URL: "https://nhvrpewgzfkarownccrt.supabase.co",

    // 2. ใส่ Public Anon Key ของโครงการ Supabase ของคุณ
    ANON_KEY: "sb_publishable_5PClf1MM430mLBokCvN4sw_bQ5LO1qm"
};

/**
 * ฟังก์ชันตรวจสอบว่ามีการตั้งค่า Supabase ครบถ้วนหรือไม่
 * @returns {boolean}
 */
function isSupabaseConfigured() {
    return typeof SUPABASE_CONFIG !== 'undefined' &&
           SUPABASE_CONFIG.URL && 
           SUPABASE_CONFIG.URL.trim() !== "" && 
           SUPABASE_CONFIG.ANON_KEY && 
           SUPABASE_CONFIG.ANON_KEY.trim() !== "";
}

// ส่งออกหากใช้งานแบบ Node (เผื่ออนาคต) หรือประกาศเป็นตัวแปร Global ในเบราว์เซอร์
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_CONFIG, isSupabaseConfigured };
}
