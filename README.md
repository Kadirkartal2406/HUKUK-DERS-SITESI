# ⚖️ Neslihan Çalışma Platformu (Çukurova Hukuk Özel)

Neslihan için özel olarak tasarlanmış, hukuk derslerini planlayabileceği, notlar tutabileceği, PDF kitaplarını/makalelerini yükleyip içerisinden yapay zeka yardımıyla **(Gemini 1.5 Flash)** soru ürettirip çözebileceği ve dökümanlar üzerinde **NotebookLM** tarzı sohbet edebileceği premium web uygulaması.

---

## ✨ Özellikler

1.  **🎓 Çukurova Hukuk Müfredatı:**
    *   1, 2, 3 ve 4. sınıfların tüm zorunlu/temel dersleri hazır yüklü gelir.
    *   Yeni ders ekleme modülü ile müfredat tamamen kişiselleştirilebilir.

2.  **📝 Gelişmiş Not Defteri:**
    *   Zengin metin düzenleyici (H1, H2, Bold, Italic, Listeler).
    *   **Otomatik Kaydetme (Debounced Autosave):** Neslihan not yazarken sistem arka planda otomatik olarak değişiklikleri kaydeder.

3.  **📄 PDF Doküman Yönetimi (Tarayıcıda Metin Ayıklama):**
    *   Sürükle-bırak yöntemiyle PDF dökümanları yüklenebilir.
    *   **PDF.js** entegrasyonu sayesinde PDF metinleri tamamen tarayıcı içinde ayıklanır. Sunucuya dosya gönderilmez, gizlilik 100% korunur.

4.  **💬 NotebookLM Deneyimi (Yapay Zeka Çalışma Odası):**
    *   Dersin altındaki notlar ve PDF'ler arasından istenen kaynaklar seçilir.
    *   Gemini Asistanı sadece seçilen bu kaynaklara dayalı cevaplar verir, hukuki özetler çıkarır.

5.  **⚡ AI Soru Çözme ve Puanlama:**
    *   **Otomatik Soru Üretimi:** Seçilen not ve dökümanlardan çoktan seçmeli, gerekçeli hukuk soruları üretilir.
    *   **Manuel Soru Girişi:** Yapay zekaya veya başka kaynaklara hazırlatılan sorular kopyalanıp yapıştırılarak interaktif bir sınav haline getirilebilir.
    *   **Yasal Gerekçe / Açıklama:** İşaretleme sonrasında doğru ve yanlış şıklar gösterilir ve her sorunun altında yasal gerekçesi (ilgili kanun maddesi ile) açıklanır.

6.  **🔒 100% Veri Gizliliği (IndexedDB):**
    *   Neslihan'ın yüklediği hiçbir dosya veya yazdığı hiçbir not internetteki bir sunucuya yüklenmez.
    *   Tüm veriler tarayıcının yerel güvenli veritabanında (**IndexedDB**) saklanır. İnternet olmasa dahi ders notları okunabilir ve düzenlenebilir.

---

## 🚀 Nasıl Çalıştırılır?

Projenin klasöründe yer alan **`baslat.bat`** dosyasına çift tıklamanız yeterlidir.
Bu işlem otomatik olarak:
1.  Arka planda hafif bir Node.js yerel sunucusu başlatır.
2.  Varsayılan tarayıcınızda **`http://localhost:3000`** adresini açar.

*Not: Bilgisayarınızda [Node.js](https://nodejs.org/) kurulu olmalıdır.*

---

## 🔑 Gemini API Anahtarı Nasıl Alınır?

Platformun yapay zeka özelliklerini kullanmak için:
1.  [Google AI Studio](https://aistudio.google.com/) adresine gidin.
2.  Ücretsiz bir **API Key** oluşturun.
3.  Uygulamanın sağ üst köşesindeki **"Gemini API Anahtarı Gerekli"** butonuna basarak anahtarınızı yapıştırıp kaydedin.

---
*Neslihan'a hukuk eğitiminde başarılar dileriz! 🏛️*
