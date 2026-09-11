window.SMG_CONFIG={
  SUPABASE_URL:"https://tjbduopbmcaeatpfjazu.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_bzdXk-8IHEkhjJKcaj1nsA_y9vu-A6Z",
  // TODAY / THIS WEEK / SCHEDULE MANAGER の基準となる「ST(サーバー時間)」のIANAタイムゾーン。
  // ST = UTC-2 固定(サマータイムなし)。ST + 11時間 = 日本時間(UTC+9)という
  // SMGの既存基準と一致させるため Etc/GMT+2 を使用。
  // ※Etc/GMT系は符号が実際のUTCオフセットと逆になる仕様のため、Etc/GMT+2 = UTC-2 です。
  ST_TIMEZONE:"Etc/GMT+2"
};