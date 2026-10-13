/**
 * India Tax & Regulatory Compliance Constants
 * Reference: Income-tax Act, 2025 (Section 393(1), replacing erstwhile Section 194-O of Income Tax Act 1961),
 * Central Goods and Services Tax Act 2017 (Section 52 TCS & Platform GST).
 */

// Section 393(1) of Income-tax Act, 2025 (erstwhile Section 194-O: E-Commerce Operator TDS on Creator Gross Sales)
export const TDS_393_1_RATE = 0.001; // 0.1% TDS when valid PAN/Aadhaar is linked
export const TDS_393_1_RATE_PERCENT_STRING = "0.1%";
export const TDS_393_1_THRESHOLD_RUPEES = 500_000; // ₹5,00,000 (5 Lakh INR)
export const TDS_393_1_THRESHOLD_PAISE = 50_000_000; // ₹5,00,000 in paise

// Section 194-O backwards-compatibility aliases
export const TDS_194O_RATE = TDS_393_1_RATE;
export const TDS_194O_RATE_PERCENT_STRING = TDS_393_1_RATE_PERCENT_STRING;
export const TDS_194O_THRESHOLD_RUPEES = TDS_393_1_THRESHOLD_RUPEES;
export const TDS_194O_THRESHOLD_PAISE = TDS_393_1_THRESHOLD_PAISE;

// Section 206AA (Penal TDS for Unfurnished or Invalid PAN)
export const TDS_206AA_PENAL_RATE = 0.05; // 5% penal TDS rate under Section 206AA for Section 393(1) / 194-O
export const TDS_206AA_PENAL_RATE_PERCENT_STRING = "5%";

// Section 194J (TDS on Fees for Professional or Technical Services)
export const TDS_194J_RATE = 0.10; // 10% TDS for professional technical services
export const TDS_194J_RATE_PERCENT_STRING = "10%";
export const TDS_194J_PENAL_RATE = 0.20; // 20% penal rate without PAN
export const TDS_194J_PENAL_RATE_PERCENT_STRING = "20%";
export const TDS_194J_THRESHOLD_PAISE = 3_000_000; // ₹30,000 statutory threshold

// Goods & Services Tax (GST)
export const GST_STANDARD_RATE = 0.18; // 18% GST on platform service fees
export const GST_STANDARD_RATE_PERCENT_STRING = "18%";
export const GST_TURNOVER_THRESHOLD_PAISE = 2_000_000_00; // ₹20 Lakhs threshold for mandatory GST registration (services)

// Section 52 of CGST Act, 2017 (Tax Collection at Source by E-Commerce Operator)
export const GST_TCS_RATE = 0.01; // 1% net TCS (0.5% CGST + 0.5% SGST or 1% IGST)
export const GST_TCS_RATE_PERCENT_STRING = "1%";
