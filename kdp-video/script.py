# Voiceover script. Each line: (Devanagari text for the TTS voice, Roman Urdu caption).
# The voice reads Devanagari because the Hindi/Urdu neural voice expects it;
# viewers see the Roman Urdu caption.

SCENES = [
    ("hook", [
        ("क्या आप घर बैठे, एमेज़ॉन पर अपनी किताब बेचकर, डॉलर में कमाई कर सकते हैं?",
         "Kya aap ghar baithe Amazon par apni kitaab bech kar dollars mein kamai kar sakte hain?"),
        ("जवाब है, हाँ! और इसका नाम है, एमेज़ॉन के डी पी।",
         "Jawab hai — haan! Aur iska naam hai Amazon KDP."),
        ("आज की इस वीडियो में हम सीखेंगे कि के डी पी क्या है, किताब कैसे पब्लिश होती है, और लेखक इससे असल में कितना कमा रहे हैं।",
         "Aaj hum seekhenge KDP kya hai, kitaab kaise publish hoti hai, aur authors is se asal mein kitna kama rahe hain."),
    ]),
    ("what", [
        ("के डी पी का पूरा नाम है, किंडल डायरेक्ट पब्लिशिंग।",
         "KDP ka poora naam hai Kindle Direct Publishing."),
        ("यह एमेज़ॉन का एक फ्री प्लेटफॉर्म है, जहाँ कोई भी अपनी किताब ख़ुद पब्लिश कर सकता है।",
         "Ye Amazon ka free platform hai, jahan koi bhi apni kitaab khud publish kar sakta hai."),
        ("न किसी पब्लिशर की ज़रूरत, न प्रिंटिंग का ख़र्च, और न ही स्टॉक रखने की टेंशन।",
         "Na kisi publisher ki zaroorat, na printing ka kharcha, na stock rakhne ki tension."),
        ("आपकी किताब ई-बुक, पेपरबैक और हार्डकवर में, दुनिया भर के एमेज़ॉन स्टोर्स पर बिकती है।",
         "Aapki kitaab eBook, Paperback aur Hardcover mein duniya bhar ke Amazon stores par bikti hai."),
    ]),
    ("pod", [
        ("इसका सबसे बड़ा कमाल है, प्रिंट ऑन डिमांड।",
         "Iska sab se bara kamaal hai — Print on Demand."),
        ("जब कोई ग्राहक आपकी किताब ऑर्डर करता है, तो एमेज़ॉन ख़ुद उसे प्रिंट करता है, पैक करता है, और ग्राहक तक पहुँचा देता है।",
         "Jab koi customer order karta hai, Amazon khud kitaab print karta hai, pack karta hai aur customer tak pohncha deta hai."),
        ("और हर बिक्री पर, आपको आपकी रॉयल्टी मिलती है।",
         "Aur har sale par aapko aapki royalty milti hai."),
    ]),
    ("step1", [
        ("पहला कदम: के डी पी डॉट एमेज़ॉन डॉट कॉम पर फ्री अकाउंट बनाएँ, और अपनी टैक्स और बैंक की जानकारी भरें।",
         "Step 1: kdp.amazon.com par free account banayein, aur tax aur bank ki details bharein."),
    ]),
    ("step2", [
        ("दूसरा कदम: निश रिसर्च। यानी ऐसा टॉपिक चुनें, जिसकी डिमांड ज़्यादा हो, लेकिन मुकाबला कम हो।",
         "Step 2: Niche research — aisa topic chunein jiski demand zyada ho, lekin competition kam."),
    ]),
    ("step3", [
        ("तीसरा कदम: अपनी किताब का मैनुस्क्रिप्ट तैयार करें। चाहे वह कहानी हो, गाइड हो, या जर्नल और प्लानर जैसी लो कंटेंट बुक।",
         "Step 3: Manuscript tayyar karein — kahani ho, guide ho, ya journal aur planner jaisi low-content book."),
    ]),
    ("step4", [
        ("चौथा कदम: एक प्रोफेशनल कवर बनाएँ। क्योंकि लोग सच में, किताब को उसके कवर से जज करते हैं।",
         "Step 4: Professional cover banayein — kyun ke log sach mein kitaab ko cover se judge karte hain."),
    ]),
    ("step5", [
        ("पाँचवाँ कदम: टाइटल, डिस्क्रिप्शन और सही कीवर्ड्स डालें, ताकि लोग आपकी किताब आसानी से ढूँढ सकें।",
         "Step 5: Title, description aur sahi keywords daalein, taake log aapki kitaab aasani se dhoond sakein."),
    ]),
    ("step6", [
        ("छठा कदम: अपनी कीमत तय करें, और पब्लिश बटन दबा दें। आम तौर पर बहत्तर घंटों के अंदर, आपकी किताब लाइव हो जाती है।",
         "Step 6: Price set karein aur Publish dabayein — aam taur par 72 ghanton mein kitaab live ho jati hai."),
    ]),
    ("royalty", [
        ("अब आते हैं सबसे ज़रूरी सवाल पर। पैसा कितना मिलता है?",
         "Ab aate hain sab se zaroori sawal par — paisa kitna milta hai?"),
        ("ई-बुक पर, अगर कीमत दो पॉइंट निन्यानवे से बारह पॉइंट निन्यानवे डॉलर के बीच हो, तो सत्तर प्रतिशत रॉयल्टी मिलती है।",
         "eBook par, agar price $2.99 se $12.99 ke beech ho, to 70% royalty milti hai."),
        ("पेपरबैक पर, नौ पॉइंट निन्यानवे डॉलर या उससे ज़्यादा कीमत पर, साठ प्रतिशत रॉयल्टी मिलती है, जिसमें से प्रिंटिंग का ख़र्च कटता है।",
         "Paperback par, $9.99 ya us se zyada price par 60% royalty — jis mein se printing cost katti hai."),
        ("और अगर आपकी किताब किंडल अनलिमिटेड में है, तो हर पढ़े गए पेज के भी पैसे मिलते हैं।",
         "Aur agar kitaab Kindle Unlimited mein hai, to har parhe gaye page ke bhi paise milte hain."),
    ]),
    ("example", [
        ("चलिए, एक मिसाल से समझते हैं।",
         "Chaliye, ek misaal se samajhte hain."),
        ("मान लीजिए आपकी एक सौ पचास पेज की पेपरबैक किताब, बारह पॉइंट निन्यानवे डॉलर की है।",
         "Maan lijiye aapki 150 pages ki paperback kitaab $12.99 ki hai."),
        ("साठ प्रतिशत रॉयल्टी हुई, लगभग सात पॉइंट अस्सी डॉलर। प्रिंटिंग का ख़र्च, दो पॉइंट अस्सी डॉलर निकाल दें, तो हर किताब पर लगभग पाँच डॉलर बचते हैं।",
         "60% royalty = takreeban $7.80. Printing ke $2.80 nikaal dein, to har kitaab par takreeban $5 bachte hain."),
        ("अगर रोज़ाना सिर्फ़ दस किताबें बिकें, तो महीने के लगभग पंद्रह सौ डॉलर बनते हैं।",
         "Agar rozana sirf 10 kitaabein bikein, to mahine ke takreeban $1,500 bante hain."),
    ]),
    ("reality", [
        ("लेकिन, सच्चाई भी जान लीजिए।",
         "Lekin sachai bhi jaan lijiye."),
        ("ज़्यादातर नए लेखकों की शुरुआती कमाई बहुत कम होती है। कुछ लोग महीने के सौ, दो सौ डॉलर कमाते हैं।",
         "Zyada tar naye authors ki shuruati kamai bohat kam hoti hai — kuch log mahine ke $100–200 kamate hain."),
        ("जो लोग लगातार अच्छी किताबें बनाते हैं, सही निश चुनते हैं, और एड्स चलाते हैं, वह हज़ारों डॉलर महीना भी कमा रहे हैं।",
         "Jo log lagataar achi kitaabein banate hain, sahi niche chunte hain aur ads chalate hain — woh hazaron dollar mahana bhi kama rahe hain."),
        ("यह रातों रात अमीर बनने का तरीका नहीं, बल्कि एक असली बिज़नेस है, जो मेहनत और सब्र माँगता है।",
         "Ye raaton raat ameer banne ka tareeqa nahi — ek asli business hai jo mehnat aur sabr maangta hai."),
    ]),
    ("tips", [
        ("कुछ ज़रूरी बातें याद रखें।",
         "Kuch zaroori baatein yaad rakhein."),
        ("किसी और का कंटेंट कभी कॉपी न करें, वरना आपका अकाउंट बंद हो सकता है।",
         "Kisi aur ka content kabhi copy na karein — warna account band ho sakta hai."),
        ("अगर आपने ए आई से कंटेंट बनाया है, तो पब्लिश करते वक़्त एमेज़ॉन को बताना ज़रूरी है।",
         "Agar content AI se banaya hai, to publish karte waqt Amazon ko batana zaroori hai."),
        ("और ज़्यादा कमाई के लिए, क्वॉलिटी पर ध्यान दें, और एक नहीं, कई किताबें बनाएँ।",
         "Aur zyada kamai ke liye quality par dhyan dein — aur ek nahi, kai kitaabein banayein."),
    ]),
    ("outro", [
        ("तो अगर आप भी अपना ऑनलाइन बिज़नेस शुरू करना चाहते हैं, तो के डी पी एक बेहतरीन रास्ता है।",
         "To agar aap bhi apna online business shuru karna chahte hain, KDP ek behtareen raasta hai."),
        ("वीडियो पसंद आई हो, तो लाइक करें, चैनल को सब्सक्राइब करें, और कमेंट में बताइए, आप किस टॉपिक पर किताब लिखना चाहेंगे।",
         "Video pasand aayi ho to Like karein, channel Subscribe karein, aur comment mein bataiye aap kis topic par kitaab likhna chahenge."),
    ]),
]
