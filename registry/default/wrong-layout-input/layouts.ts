// Bollard UI — wrong-layout-input · MIT licence · https://bollard-ui.vercel.app/components/wrong-layout-input

// Keyboard layouts and the wrong-layout detector behind WrongLayoutInput.
// Pure functions, safe on the server.

/** The US QWERTY keys every layout below is aligned to: grave, top row, home row, bottom row. */
const US_KEYS = Array.from("`qwertyuiop[]\\asdfghjkl;'zxcvbnm,./")
const US_SHIFT = Array.from("~QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>?")

export interface KeyboardLayout {
  /** Language name shown to people ("Russian"). */
  name: string
  /** BCP 47 tag, set as `lang` on converted text so screen readers pronounce it. */
  lang: string
  /** What each US key types without Shift, in US_KEYS order. */
  keys: string
  /** What each US key types with Shift. Omit when Shift types Latin capitals (Hebrew). */
  shift?: string
  /** Other US characters that type something else (Russian Shift+7 types "?"). */
  extra?: Record<string, string>
  /** Combining marks typed before their letter, like the Greek tonos dead key. */
  dead?: string
  /** Matches one letter of the layout's script. */
  letter: RegExp
  /** Spellings no real word has (a Russian word never starts with ь). Text that only converts into one is left alone. */
  impossible: RegExp
  /** Spellings only correctly typed text has, like a Hebrew geresh (ג'). Words with one are never flagged. */
  native?: RegExp
  /** Shift types other letters instead of capitals (InScript), so mixed case on the Latin side is expected. */
  shiftLetters?: boolean
  /** Folds a word before scoring: case, and marks the model ignores. */
  fold: (word: string) => string
  /** Bigram model: two characters (^ and $ mark word edges) then a letter a–t, the bigram's -log2 frequency. */
  model: string
}

// Bigram models built from ~300k characters of Wikipedia intro text per language (counts >= 2, Hindi >= 5).
const ENGLISH_MODEL =
  "e$es$e^tfanfthfhef^if^afinfn$ferfd$f^sft$f^ofonfatgl$g^cgisga$gndgngg^mgstgtegy$griglegr$g^fg^dgregedg^bgarg^pg^wgasgo$gesgitgengorgtigofgf$gntgalgtog^hgchhhahtahamhm$htrhrahlihmahdihiahilh^lhlahllhech^nh^rhh$hrohcehnahsohouhunhwahcohomhseh^ghnehnihg$hrtholhelheahdehbehcahmehhihichhoh^ehurhlohfohsihiohvehush^uinsimiiagigeiryifiiirictibyipri^kiacik$impipoiosishigairsibaisuiwiiivi^jiayipliemissiadidaitsietiutiviiidic$iulilyiooiotifeifrityiociciirnieeiieii$iowinoiweiovinciboi^vipaiopiaiipeimoiigituiwhiucjttjcljimjgujuajodjdujnnjckjsajabjbujvajupjmbjwojrkjfajaujavjrljcrjkejoajegjspjexjcujbrjkijlsjmmjuejgrjphjifjrcjpijwnjdojefjp$jrmjrujrrjevjghjscjuijmujrgjbljyejgojldjipjrdjugjumjudjgijpujubjlujewjw$jltjnujapjeijbijepjtljakkkakslkyskhrklmku$k^ykahkdrkjakyakppkcckksksykhukjuktbkskkrvkebkokkafkflknykqukffkibkizkzekogkknkhtkeoktwkglkobkawkptkftkv$kdskmskeykgnkyokoikylkvokb$kjokx$lmylajlnklddlgsldylhllcsldmlkolhyliulxileulaelazlzilrpleklpsluklzalsmljelswllflxtlrhlwrl^zlohllblyml^qllvlnfliklfultclnmlnvlixlehleqlcylnllxalrblz$loelbslwslhnlj$lgyltvlaxmsrmyimxemhwmufmnbmlpmrfmsbmdwmtnmxpmdhmlkmklmoymdgmlcmaamiimpmmdlmtmmnhmynmsfmycmdvmyrmnrmkhmoxmpymypmjimiqmhsmnzmrwmgtmkmmkumzomhmmkymlgmijmkrmezmdcm^xmbhndtnuonmcncqnojnihniynbcndnnggnnpnhbnwynnjnlwnytnvuntpnnwngbncbnydnxcngmngdnyunzhntznbjncdnsnncpnybndbnrznbbnbtnwlnsdnejnsqnsvnq$nsznfcnvrnuvngxooqohvokkokbozyohdozuouhovloaqolnotdokcouyoaoomnodfoujoxyoywogwomtoozofsomlopcofyojdolhoxhobmoktohpomwowborqokwowtonqotfoczovyodzohkowuouxouzovsoljocnojromrogzovdovnowpovfodqohfopxogfpwdplzppgpwmppdpsgpxupiwpqapdkpcfpkvpdjphcpcmpkgpygpjhpzdpztphhpdppyvpzmpfkpuwpxopzzpfmpmhpwgpbnpvmpfxppnpykpkpppbpyfprjpkfpuqplrpvkpmfpgppzlpyzpwfptgpvbpwkpxvpwcpnxpqlpcgpwwpfbpkqpjbqyhqmgqzkqpfqxmqmvqfgqfhqmxqjnqhgqqqqqeqfjqpwqjkqgcqzrqjfqbdqjsqvhqqoqyyqbgqxbqzcqvgqfpqkdqtjqbwqpkqgjqzbqqiqcwqwxqbpqfnqpvqfvqqbqxsqqvqmzqmjqyjqjjqkjqjzqkxqsjqwvqwjqwzq"
const RU_MODEL =
  "^сfй$fстfо$fа$f^пf^вfе$fи$fорgриgалgовgскg^гgерgроgлиgкоgгоg^иgанgноg^рgодg^оgелgльg^кgкаgпоgолgреgенgтаgв$gя$g^дgниgныg^мgраgм$gосgтоg^нgнаg^бhбоhисhс$hмаhк$h^аhлеhсеhевhвиhсоhвеhетhкиhийhр$hойhтиhчеhесhогh^тhтрhдаhваhобhлаhатhтеhь$hвоhу$hнеhн$hонhинhдеhикh^уhасhотhннhы$hпрhедhавhзаhомhлоhдиhитhт$hдоhияhарhилhиеhмиhемhпеhл$hииhмеhимhх$hизh^чiакiекiичiтсiциiруiивiд$iблiадiссiейiнсiнтiокiктiбрiряi^лiчаiтнiтвiайiляiсяi^зiю$iкрiоеiвнiгрiхоiсиiвсiмуiпаiьнiазiмоiпиiихiирiндiрнiыйi^еiаяiвыiамi^эiспiыхiурiйсiгаiтьiдуiднiегiбыiгиiжеiсаiслi^фiбеiксjееj^шjгеjиаjудjкуjубjлуjтуjабjчиjучjйоjдсjвлjзвjиюjснjняjзоjидjунjицj^яjянjапjочjьсj^цjцеjшиjыеjпуjнкjтыjхаjклjукjнгjглjнцjупjщиj^жjжиjщеjахjмпjаеjплjз$jопjагjуюjигjгуjрвjшеjожjрыjг$jутjртjджjсвjацjшаjдрjылjужjкеjымjятjзнjачj^хjбаjчнjбиjврjждjезjдлjозjжнjрсjрмjфеjзиjиоjздjргjсуjфиjулjусjумkч$kофkёрkоцkсрkтяkябkлёkечkйнkялkлсkояkязkецkвхkипkежkзрkррkцаkвтkкмkямkжаkёнkбуkьяkепkафkвкkлкkмнkркkрдkзеkэнkлюkнуkвшkп$kьеkб$kугk^юkоиkявkяеk^йkхиkьюkмыkибkрхkэтkохkлыkеоkчтkвяkмяkебkрбkаюkютkдвkсьkзыkывkньkвуkфаkллkауkысkфрkкжkфоkаиkмсkющkехkсмkдыkквkузkажkткkыкkьмkшоlётlцкlнвlдмlижlрлlьтlящlьшlооlбщlощlщаlдьlмлlючlчёlюнlзуlещlё$lршlышlшлlсёlгдlынlешlц$lеяlзмlпыlлгlхрlсчlсыlьбlппlыпlущlвпlхуlжуlэлlммlюрlашlфуlтбlуеlефlбнlуаlядlэкlрьlржlяхlмбlащlсбlшвlёлlякlвгlошlушlштlькlбъlтлlсхlжоlюгlцыlфлlифlэрlсшlлнlытlьзlхнlеёlярlюлlф$lяюlухlеаlчуmйбmтчmоюmюзmжсmчкmйшmрпmмьmпнmдяmэсmэмmвьmьёmёвmтдmдкmкнmырmрёmёхmвёmмкmеиmщёmтёmж$mшнmхеmъеmш$mввmлтmттmюдmсдmзяmяяmхмmйдmйтmйлmдёmймmрцmцоmбсmхсmчлmккmнщmгнmдшmнёmюсmыдmьдmоэmяжmнфmйцmзгmвдmюжmычmшуmуэmоаmясmдпmтмmзлmишmшкmнчmнрmпяmуиmэ$mяпmцуmнзmзёmвзmлдmувmптmлжmоуmддmщнmгвmдзmищmйкmёмmгкmсфmрфmзсmуоmюбmкцmтюmбкnвцnфсnтхnсюnжёnгмnчьnбдnюмnдчnрчnдюnяйnвмnнлnьцnрюnббnйеnъяnаэnгсnмёnьгnнбnбяnжчnеюnыбnмфnьфnааnёзnызnпсnмвnиуnрэnэпnтфnбюnсцnхвnхтnячnяцnыгnуфnчшnнхnншnчрnнжnжкnьиnжбnдэnэйnмэnэвnффnггnоёnпьnёгnлмnеуnкыnуйnзэnйрnшёnуцnтэnзбnдцnьпnбьnжьoгчoкхoчоoрзoюкoйяoхлoлвoзжoьоoьвoфгoзкoнюoьщoзьoцвoдтoлфoбвoтпoфтoйзoмюoгэoйхoууoйчoтгoбхoёкoягoйвoшьoсэoэдoкэoгыoхэoшрoтцoкёoюцoдхoлбoщьoкбoаоoбтoкгoпёoкшoэфoюйoзюoвэoфнoкюoлхoйаoъёoхкoкпoшсoфёpгьpмгpёсpиэpпфpхбpпцpдгpтзpшпpгтpсгpлэpвщpёдpмрpбжpшмpфэpйгpаёpбэpдбpэгp^ыpпшpмдpяшpьчpыиpчвpэцpфыpцюpэбpвчpнпpбмpёжpцзpнэpгбpзцpьхpуяpгюpёйpбчpюхpццpмчpыжpфьpхзpщуpкяpлчpщ$pйиpдфpвжpкъpгъqнмqхъqююqчыqцгqпчqпкqбпqмтqюэqмхqхпqбшqювqлпqзъqпэqфюqмцqюиqэшqкфqцьqсжqжрq^ёqлшqгпqцлqюаqчэqчсqкзqгёqкьqбёqвюqърqыяqцбqьрqшхqхьqвбqсъqгшqфмqйыqчхqъаqпгqйпqпюqйфqяоqшэqьжqъ$qьаqэхqьуq"
const HE_MODEL =
  "^בeת$e^הeה$eר$fי$f^לf^שfל$fיםfם$f^אf^מfותfניgריgיתgביgיוgולgליgיהgורgן$gשלgהמgו$gאוgמוgרוgא$gייg^וg^עg^יhיאhנוhהוhונhבוhודhובhבמhברhהיhוןhדיh^חhחוhירhלהhהאhמיhעיhדוhיקhלוhפוhעלhינhומh^כhאלhטיhס$h^גh^קhפיhקוhופhפרh^סhואhק$h^פhשיhמשhאיhוסhסיhידh^נhד$hארhב$hתוhילh^רhבאhשוhויhשנhנהhווhראhאנiושiש$iימiמנiבהiנגiגרiט$iבנiיסiסטiטוiוקiקרiכיiכוiלמiמדi^דi^תiוםiמחiהעiועiהפiהבiלאiהסiסוiוצiציiרטiקיiיטiבלiשבiהרiבתi^זiספiיןiמהiח$iרכiהתiתרiרבiתיiוגiג$iהשiך$iע$iוהiגיiצוiערiרתiשהiמעiבעiחיiאחiהקiמאiחרiכלiבשiישiדרiמתiאמiף$iוכiגלiשרiמסiרהiעוiאתiמרiרגiגוiנתiאשiיבiטרiהלiץ$jמבjמכjההjקטjתחjחקjללjנסjלטjלפjתקjפתjפקjהצjלקjרחjהכjבסjשפjחתjצאj^צjשמjשםjנדjהגjיעjגםjרצjפהjבקjקהjמקjוטjכתjזרjחדjיכjלכjלרjזהjממjפעjעםjלבjבדjנקjרקjעדjיחjשתjבחjזיjיפjפנjאסjשחjמצjכבjסדjטלjיזjרפjקאjאהjרנjדהj^טjז$jרמjבפjוחjנאjגדjמלjלחjכנjלשjחבjהחjרדjלדjכהjהנjפסjרסjקלjסקjלתjנטjקבjיגjתהjמפjיצjאפjסרjחלjלסjהםjמטjזוjלנjצמjצרjוזjפלjשאjעבjהדjפשkשטkבכkאקkקדkדמkדעkתנkעתkטאkאבkבטkשכkכןkתבkקתkכרkפחkהזkצפkקשkנמkכאkבצkפ$kעהkצהkאןkנחkחשkגבkעשkכ$kהןkרשkחהkדשkקנkוףkסתkחזkחמkתפkהטkרלkלםkאטkבבkעצkנכkצבkסלkאםkתכkתםkגנkחסkצעkעמkקצkצ$kכדkדתkנבkפטkטנkמזkאזkאגkטהkנפkקסkרץkלעkמ$kסמkכשkסגkבגkנשkתאkלגkמןkשעkוךkאדkכמkתמkזכkזמkרךkנרkמגkכחkכזkדלkפאkגהkיץlנלlגאlטןlששlרזlרןlצלlיךlדדlגזlטפlאךlפןlדנlגשlזאlקןlוץlדאlפבlכפlטתlבזlאצlלןlצתlגתlטמlלךlכסlסנlצחlטחlעקlגמlשקlנצlחנlתלlתגlלצlרםlרעlתעlתןlנעlחצlדגlסאlדצlדםlגןlאףlטעlסהlקפlבןlכךlשגlתתlשךlקמlסבlענlססlדבlררlלזlסףlטבlסכlדפmנןmנזmתשmפגmטסmיףmגעmדקmלףmפכmתסmמםmעזmקעmסעmשדmסםmצגmדסmצדmזםmצטmפצmטגmדןmעסmקםmזנmככmטקmעטmזקmפךmנ$mכגmננmנםmחםmסחmגטmזלnזעnעפn^ןnטטnקחnשסnחןnסןnחאnשזnרףnשןnעץnקקnתצnתזnפדnפזnתףnחגnטכnגפnנףnאכnצנnזבnזןnגסnטשnכעnדחnקזnכםnחטnקףnעכnטדnעגnחפnכקoחץoבםo^םoמךoפץoעןoכףoתדoכטoזחoטצoצקoפמoזגoאאoשצoסךoטזoדטoחכoדזoבךoסצoתטpגחpצםpאץpצצpנץpמץpחףpדכpזצpדףpזדpטףpזטpזתpנךpצןp^ףpלץpאעqשףqטםqגףqבץq^ךqסזqזסqכצqדךqצסqצףqקגqפףqכץqגקqפםq"
const EL_MODEL =
  "ουeς$e^τeα$eο$f^εfανf^κfικfκαfειfιαfι$f^αfαιfν$fτηf^πfη$fταf^σfστfτοfυ$fποf^οgμαgνοgκοgαρgηςgε$gατgτεgοςgναgωνgερgριgιοgμεgραgονg^μgροgτιgινgενgσιh^δhδιhελhλεhσεhημhηνhπεh^ηhλαhνιh^βhισhκεhετhολhλιhκηhμοhαςhαλhαπhομhτρhλοhορhρεhοιhνεhοτhασhσηhοπhπρhπαhντh^νhληhητhυνhγιhεςhνηh^γhυτiρηiχεiεσiδηiαθiθηiιωiδοiακiκτiιτiσκi^χiκιiιδiεχiιλi^θiθεiσαiσμiεγiγαiαμiβαiμπiπιiγκiμιiεκiαγiρωiσοiοσiαυiυσiηρiκρiνωiαφiφοi^λiγοiτωiωςiδεiυπiλλiαδiιςiυςiσυiυμiηκi^ιiεπiυρiευiησi^υiιεiργiγεiγρi^φiογiμηiωσiωτiεμjμμjηλjιχjρχjχοjοδjπλjβρjχαjχιjσσjβοjλυjοχjχηjμβjγωjκωjδρjτ$jβιjοφjφεjδαjαβjεδjοκjιρjπηjωμjηθjω$jχωjνδjβεjκυjπτjθαjωρjηγjφιjιμj^ρjφαjεξjιπjρμjχρjυγj^ωjζεjγηjδυjεθjλωjυλjκλjεωjλ$kτσkιθkθωkρτkκ$kιβkγγkγλkυαkσπkρ$kθυkιγkμφkφωkθοk΄$kρυkδωkοθkοβkυχkρνkαξkξιkεαkυδkζοkφηkυθkαζkζιkιζkλμkτυkτζkρκk^ζkζαkγνkωγkβλkννkυοkξεkθνkεφkπωkιηkαχkσωkυκkοεkσχkξηkμ$kμυkωπkθμkεοkεβkξαkιφkμωkφρkχνkνγlαοlρρlρθlμνlυψlθιlσφlξυlφυlνυlεζlγυlθλlχθlυζlνθlηφlλφl^ξlωθlτμlαεlψεlυεlκδlγχlζωlηχlνσlυβl^ψlψηlγμlοηlφθlρδlτλlθρlσθlοξlπ$lρσlλτlοαlυηmλκmσβmτςmδ$mκσmβ΄mωδmψοmυφmαψmζυmππmφ$mεψmρξmπνmφτmωηmσλmκκmρφmρλmχτmιξmζ$mβ$mοοmωβmζηmοψmεεmχλmωαmττmυξmξοmχ$mλγmβηmχυmωλmυιmλνmα΄mηπmνςmπυmρβmλβmλπnψυnοζnψαnφλnλδnιψnβωnγ$nκπnαηnωκnνκnηψnβυnηδnκμnσδnκνnσ$nθ$nρπnυωnλθnξ$nγ΄nααnξωn^$nωζoσρoβδoηβoλσoμψoιιoχμoωοoωιoωφoκφoτθoκθoψιoνζoκβoρςoοωoηξoνμoνρoκχoσνoφγoνλoβγoββoη΄pμςpκςpξπpωεpψωpγδpε΄pεηpτνpφσpθγpπσpφνpνχpωχpτβpωξpτφpβνpηιpρζpπςpπμpζμqλςqμσqτ΄qνφqδ΄qμτqζνqνβq΄ιqτγqςςqγβqζ΄rθκrνπrχσrζλrξτrξνrπ΄rφφrμρrδτrδμrζκrβσrλχr΄πrτκrδνrμγrπζrπχrπκr"
const HI_MODEL =
  "^कeे$eी$fा$f^हfकेfर$f^सf्रfं$f^मf^पf^बgकाgक$gहैg^जg्यgयाg।$g^अgन$g^वgारgय$g^रgराgमेgेंgर्gत$gस्gलाh^लh^तhल$h^एhएकh^गhै।hस$hकीh^नhनिhिकhसेhकिhिलh^दhरिhियhोंhानh^भhभाhरतhन्hम$hक्hत्hसाh्वhमाhवाhप्h^यhताh^उhद्hनाhो$h्तh^औhऔरhितhालh^इhविhतिhरीhकरhनेhपरhकोhबाiासiनीiसीiगाiव$iइसiसंiग$iट$iयहiह$iपुiुरi^शiग्iपाiयोiरोiहाiतीiीयiाजiजाi^थi्मi्षiथाiदिiसमiादiद$iामiज्i्थiण$i^चiए$iजिiिसiसकiतरiंगiलेiश्iायiै$iिनiम्iलिiष्i्टiिरiधिiवरiरेiांiातiं।iल्iेशi^फiदेiा।iैंiउनi^आiलीiमिiई$iप$iहोiि$iेलjीलjाँjजनj^१jजोjहरjलोjमीjूरjेनjव्jापjमहjथेjकुjहुjपूjतकjयुjदाjरणjेतj्धjचाjाहjहिjिएjवेjधाjोगjअनjध$jण्j्डjमुjेरjथिjाथjज$jचिjिमjशिjज़j^खjंडjड$jभीjेकjनुjहीjींj़$jाकjाषjट्jिधjषेjाइjोनjवीj्नjगयjरकjश$jअंjंदjरूjोतjशाjउतjड़jरनjबनj्दjदीjषाj^टjिंjरहjहेjसिjच$jटेj्हj्लjिशj^डjिवjतेjटीjीनj्कjअपjपनjंतj्पjोरjु$jअधjब्jंसjू$jनोjनकjयकjूपjागjावjाईjथ$jजीjृतjसरjरमj्सjसनkतहkहसkँवkख्kलगkटरkदूkरसkुलkुआkवतkरुkष$kवंkे।kउदkमकkथीkगोkबिkिहk्गkगतkमणkडलkरंkाबkसुkौरkुनkंजk्चkबंk्शkिदk़िkनगkगरkुदkुखkलयkुसkीतkिजk्ञkसभkवहkब$kयरkबेkेटkटाkमंkसबkशनk^छkपेkमैkिटkयूkपीkनवkरवkयमkगुkदरkूनkबरk़ाkपतkुकkँ$kाणkखाkगढkढ़k़ीkंटkाडkफिkकहkुमkंकkकलkरदkीसkडिkइनkीमkउसkंनkिपkध्kकृk्णkबसkख$kेसkेखkउपkंबkदोkलनkोडkगिkसदkगीkपहkैसk^घkपिkभिk्बkीवk^धkवनkवसkतुkहतkंचkबीkयेkकतkंधkाधkमोkअरkिषkतमkी।kोकkहलkोलkअलkफ़kेवkमूkलकkाओkओंkेजkतथkषिkअभkीकkीरkडाkमनkूलkटिkीपk्जkफ्kसलkयनk्$kणीlनसlंखlभगl०$lोधlशहlोमlीटlअगlोहlआ$l^ईlवैlमरlएवlरथlधरlगणlुपlुंlगेlपशlसूlनहlहमlमदlाचlचनlपंl^ओlिखlखनlयीlाशlरपlबैlपोlमलlचेlबहlहनl^२l२$lाखlखणlइंlखिlशीlमसlअकlिभlेमlघरlॉरlजूlलैlीजlटूlदसlोपlफाlडेlनमlाफlफ$lपदlतोlुडlिगlृषlणाlबडlशुlआतlचुlाएlखेlशोlछोlड्lडीlशकlमधlकैlमयlपैlमतlवोlकईlगएlए।lबोlपकlोटlजबlजैlटकlुतlतनlिणlुछlछ$lीचlकमlबलlआरlोसlधनlटोlंहlकनlंपlजुlूमlरॉlरशlूसlअवlरभlुईlैनlनरlरलlभूlलमlअमlरचlञाl़नlरयlकॉlेडlॉलlजेlैलlलंlभ$lोजlंवlफलl१$lबुlनतlुवlदुlशेlगलlतंlसहlच्lलवlजमlअसl्फlइतlैरlयवlसैlरबlआयlदौlचीlटनlपयlदकlसोlजरlेषl^ऊlयंlः$lषणlूतlंभlुएlयतlचलlआधl^ऑlलतlदलlरखl^ऐlडोlनदlरैlववlगईlवजlणिl१९lाटlठ$lंशlलूmगभm००mकटm^३m^।mईसm७$mैदmररmुगmुषmथमmोदmदयmमगmगंmयिmणनmूचmुहmओरmलपmोशmथ्mठाmरजmख़mाऊm़रmेगmनलmेदmआईmीगmलरmकपmरगmडुmनंmआनmैचmशतmससmउलmपलmलबmलॉmोवmीदmेबmअफmगैmदशmयपmूटmचोmैतmबदmदनmलुmगठmगहmखीmआदmिडmरधmधीm२०m६$mवलmछाm़ेmऊँmआगmपसmकूmएँmआवmथोmपडmननmयदmइलmतौmभवmएंm^ठmअबmबूmइमmआमmमृm़्mफीmतलmगूmीडmसतmंरmँचmछतmजसmॉनmडॉm्भmबढmभोmभरmजगmौतmघाmअथmनूmुटmाउmजयmबचmूजmथलmचैmूबm४$mफरm५$mयसmगसmीबmई।mयलmखरmूहmइकmखलmदृmवपm्छmएलmडरmबकmफोmंयmसौmणोmजलmअतmतःmजहmैशmंघmैमmकसmथवmवृmवशmततmआजmुओmधुmआकmुणmैजmोबm॰$mिचmएसmीएmययmरफm१८m३$mेपmेयmपटmइटmसवmझाmोषmतृmमौmूदmोचmदमmगनmुशmचरmशैmबजmणुmैकmआंmटलmखोmकवmआ।mिबmनैmसफmूकmचकmतवmवधm९$mऑफmऐसmखुm^झmरौmहवmौदmुजmाठmिथmफेm८$m्ठmक़mएमm़ोmॉकmृंmरृmाघn१०n३०nषतn^४nगपnजधnपौnमपnघुnञ$nइजnपृnचमnूडn़ुnुबnग़nगवnचौn़वnौडnउमnेहnषयnजॉnछहnमईnीफnपणn़कnटमnडकnठिnूंn०१nबईnकडnलौnौटnटतn़तnतबnकथnठनnीआnओ$nनौnौसnकंnिफnॉफnएशnशरnवकnॉमnकौnतैnधकnलसnगौnथरnनयnकभnशंnहॉnनईnडमnसगnढ$nैणnयणnौलnतपnॉपn०२nवयnछेnीणnबतnभौnौगnगमnउंnेणnऊरnमॉnॉडnषजnयःnृदnषकnषोnभेnाभnआसnसपnोयnपमnषीnपजnऑसnपॉnएनnघ$nगडnपचnऐतnौजnजपnअचnफैnआलnकदnधोnघोnघटnृहnभ्nुधnजंnकशnैयnभयnकबnटवnथनnैटnॉटnउगnआपnछिnखतnुयnोईnमजnुचnठीnणकnशबnशलn^५nमझnॉ$nऊपnौनnहूn९८nएडnह्nबॉnनजnबौnअडnीहnैपnदबnउरn९७n^८n४०n९६nगदnनशnउचnुभnमबnी॰nहकnजकn१७nुफnवमnनृnषदn^ऋnभुnसॉnइडnौधnचतn^ढnमशnउडnझीn१४n़बnआइn९९nलडnआठnनटnेथnबमnलहnोणnफुnऊषnवणnघेo२५o^६o३७oजवoथकoणेoणरoरघoखंoृथoछठoैगoधमoतूoडनo़मo१६oटफoहंoनडoठोoईंoेचoएटoहणoॉजo़लoईएoएपoयशoूवoीशoंथoौशoअहo११oअशoचंoवुoएरoयगoईलoआशoौकoटॉoपगoैठoीछoघनoतसoछीoओटoगटoददoशयoपभo्घoजटoपषoसशoूषoषमoउभoऔदoभंoषरoइरoदवoञतoूएoअजoनएo८०oधेoणपoुझoैधoैबoनपoगृoरषoअदoनबoॉयoडपoओलoगॉoआँoणमoटुoशसoऑपoपवoुँoएजoटबoदपoअखoहटoऊंoभलoउठo^९oजशoएचoनॉoककoवॉo०६oूँo८३oऑकoयभoहपoूखoइयoफूoतटoउटoधतoलघoठेoॉ॰oडवo१२oणवoसटoलदoइचoौंoनःoएगoलखoऊ$o८२oवटoघिoैथoइगoछलo८८oईरo५६oईपoशूoसजoटसoयौoयजoऋषo^७oॉसoसडoवगoचूoइबoँकoय्oऋणoोइoहचoपथoखडoइ$o९४o४७oआबo९५oीषoचवoएथoछूo९३oआउoोफoॉइoखकoटैoझनoिछoॉबoशौoौचoणतoढाoझ$oचयoैवoदतoॉगoओडoँधoघंoैडoफॉoहयoजदoडैoइवoट।oऐलoवदo७०oहजoचपoकठoयॉoएफoहडoबपoणयoहदoएयoओमoऑरoयटoआएoनफoडबoीखo८४oूयoहौoाझoोथoघमoमएoइपoखगoधपp४२p५०pबटpफगpचडp़जpेओpआखpवथpलचpहथpथंpठकpकचpँगpनधpौथp१५p्खpमवpतखpूढpहबp६०pफतpंझpढोp२४pीठpसचpशवpडसpूगp७१pनचpौहpमचpैषpठंpषुpअयpभदpदहpाढpअणpिठpछुpो।p^षpषषp६४pृकpृशp३१p९२p२८p२६pछवpशृpझरpलभpवचpयधpथशpयबpधवpलटp५९pऋगp३३p२९pेफpृढpोएpठवpऐकpचढpतयpीःpकणp२३p८५p८वpर।pीढpदंpखैpुघpललp६७pणशpशमpसठpरआp"
const lower = (word: string) => word.toLowerCase()

export const RUSSIAN: KeyboardLayout = {
  name: "Russian",
  lang: "ru",
  keys: "ёйцукенгшщзхъ\\фывапролджэячсмитьбю.",
  shift: "ЁЙЦУКЕНГШЩЗХЪ/ФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,",
  extra: { "@": '"', "#": "№", $: ";", "^": ":", "&": "?" },
  letter: /[а-яё]/i,
  impossible: /^[ьъы]|[ьъ][ьъ]/,
  fold: lower,
  model: RU_MODEL,
}

export const HEBREW: KeyboardLayout = {
  name: "Hebrew",
  lang: "he",
  keys: ";/'קראטוןםפ][\\שדגכעיחלךף,זסבהנמצתץ.",
  letter: /[\u05d0-\u05ea]/,
  // Final letter forms only ever end a word.
  impossible: /[ךםןףץ](?=[\u05d0-\u05ea])/,
  native: /[גזצת]['׳]|["״]/,
  fold: lower,
  model: HE_MODEL,
}

export const GREEK: KeyboardLayout = {
  name: "Greek",
  lang: "el",
  keys: "`;ςερτυθιοπ[]\\ασδφγηξκλ\u0301'ζχψωβνμ,./",
  shift: "~:ΣΕΡΤΥΘΙΟΠ{}|ΑΣΔΦΓΗΞΚΛ\u0308\"ΖΧΨΩΒΝΜ<>?",
  dead: "\u0301\u0308",
  letter: /[\u0370-\u03ff\u1f00-\u1fff]/,
  // Final sigma only ever ends a word.
  impossible: /ς(?=\p{L})/u,
  fold: (word) => word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
  model: EL_MODEL,
}

/** Devanagari InScript, the Government of India standard layout used for Hindi and Marathi. */
export const HINDI_INSCRIPT: KeyboardLayout = {
  name: "Hindi",
  lang: "hi",
  keys: "ॊौैाीूबहगदजड\u093cॉोे्िुपरकतचटॆंमनवलस,.य",
  shift: "ऒऔऐआईऊभङघधझढञऑओएअइउफऱखथछठऎँणऩऴळशष।\u095f",
  extra: { "=": "\u0943", "+": "ऋ", _: "\u0903" },
  letter: /[\u0900-\u0963\u0970-\u097f]/,
  // A vowel sign, virama or nukta can't start a word or follow a vowel or virama.
  impossible: /^[\u093c\u093e-\u094d\u0901-\u0903\u0962\u0963]|[\u0901-\u0903\u093e-\u094d\u0904-\u0914\u0960-\u0963][\u093c\u093e-\u094d\u0962\u0963]/,
  shiftLetters: true,
  fold: (word) => word.normalize("NFD"),
  model: HI_MODEL,
}

/** Every built-in layout, checked against US English QWERTY. */
export const KEYBOARD_LAYOUTS = [RUSSIAN, HEBREW, GREEK, HINDI_INSCRIPT]

const UNSEEN = 22
const models = new Map<string, Map<string, number>>()
function bigramCosts(model: string) {
  let table = models.get(model)
  if (!table) {
    table = new Map()
    const chars = Array.from(model)
    for (let i = 0; i + 2 < chars.length; i += 3) table.set(chars[i] + chars[i + 1], chars[i + 2].charCodeAt(0) - 96)
    models.set(model, table)
  }
  return table
}

/** Average bits per bigram, negated: higher means the word looks more like the model's language. */
function plausibility(word: string, model: string) {
  const table = bigramCosts(model)
  const chars = ["^", ...Array.from(word), "$"]
  let cost = 0
  for (let i = 1; i < chars.length; i++) cost += table.get(chars[i - 1] + chars[i]) ?? UNSEEN
  return -cost / (chars.length - 1)
}

const maps = new WeakMap<KeyboardLayout, { local: Map<string, string>; latin: Map<string, string> }>()
function keyMaps(layout: KeyboardLayout) {
  let entry = maps.get(layout)
  if (!entry) {
    const local = new Map<string, string>()
    Array.from(layout.keys).forEach((char, i) => local.set(US_KEYS[i], char))
    if (layout.shift) Array.from(layout.shift).forEach((char, i) => local.set(US_SHIFT[i], char))
    for (const [us, char] of Object.entries(layout.extra ?? {})) local.set(us, char)
    const latin = new Map<string, string>()
    for (const [us, char] of local) if (!latin.has(char) && us !== char) latin.set(char, us)
    entry = { local, latin }
    maps.set(layout, entry)
  }
  return entry
}

/** Retypes Latin keystrokes as `layout` would have typed them: "ghbdtn" → "привет", "kalhm;era" → "καλημέρα". */
export function toLayout(text: string, layout: KeyboardLayout) {
  const { local } = keyMaps(layout)
  const chars = Array.from(text)
  let out = ""
  for (let i = 0; i < chars.length; i++) {
    const char = local.get(chars[i]) ?? chars[i]
    if (layout.dead?.includes(char)) {
      // A dead key waits for the next letter and lands on it.
      const next = local.get(chars[i + 1] ?? "")
      if (next && layout.letter.test(next)) {
        out += next + char
        i++
      } else out += chars[i]
    } else out += char
  }
  return out.normalize("NFC")
}

/** Recovers the US keys that typed `text` on `layout`: "руддщ" → "hello", "שלום" → "akuo". */
export function fromLayout(text: string, layout: KeyboardLayout) {
  const { latin } = keyMaps(layout)
  let out = ""
  for (const char of Array.from(text)) {
    const key = latin.get(char)
    if (key) {
      out += key
      continue
    }
    const [base, ...marks] = Array.from(char.normalize("NFD"))
    const baseKey = latin.get(base)
    if (baseKey && marks.length && marks.every((mark) => latin.has(mark))) {
      const markKeys = marks.map((mark) => latin.get(mark)).join("")
      out += layout.dead?.includes(marks[0]) ? markKeys + baseKey : baseKey + markKeys
    } else out += char
  }
  return out
}

export interface LayoutChange {
  /** Offset of the word in the original text. */
  index: number
  /** The word as typed. */
  from: string
  /** The word retyped in the other layout. */
  to: string
}

export interface LayoutFix {
  layout: KeyboardLayout
  /** "toLayout": Latin typed while meaning the layout's language. "toLatin": English typed with the layout on. */
  direction: "toLayout" | "toLatin"
  /** The whole text with the wrong-layout words retyped. */
  text: string
  changes: LayoutChange[]
}

interface Candidate extends LayoutChange {
  margin: number
  letters: number
}

// Numbers, handles, links, domains and dotted initialisms (P.E.C.H.) are never retyped.
const SKIP = /\d|[@#]|:\/\/|^www\.|^[\w-]+(\.[\w-]+)*\.[a-z]{2,}$|^(\p{L}\.)+\p{L}?$/iu
const NATURAL_CASE = (word: string) => word === word.toLowerCase() || word === word.toUpperCase() || word.slice(1) === word.slice(1).toLowerCase()
const trimTo = (word: string, letter: { test: (char: string) => boolean }) => {
  const chars = Array.from(word)
  while (chars.length && !letter.test(chars[0])) chars.shift()
  while (chars.length && !letter.test(chars[chars.length - 1])) chars.pop()
  return chars.join("")
}
const LATIN = /[a-z]/i
const english = (word: string) => trimTo(word.replace(/'/g, ""), LATIN).toLowerCase()

/** Scores one whitespace-separated word as typed in one layout and meant in the other. */
function candidate(word: string, index: number, layout: KeyboardLayout, direction: LayoutFix["direction"]): Candidate | null {
  if (direction === "toLayout") {
    const letters = english(word)
    if (!letters || (!layout.shiftLetters && !NATURAL_CASE(letters.replace(/[^a-z]/gi, "")))) return null
    if (word === word.toUpperCase() && letters.length <= 4 && !layout.shiftLetters) return null // acronyms: NHS, API
    // Every letter key must type a letter there too ("Tariq" would lose its q to the Greek ";").
    const { local } = keyMaps(layout)
    if ((word.match(/[a-z]/gi) ?? []).some((char) => !layout.letter.test(local.get(char) ?? ""))) return null
    let to = toLayout(word, layout)
    // "Jkmuf," may mean "Ольга," with a habitual comma rather than "Ольгаб": keep whichever reads better.
    const tail = word.match(/[.,]+$/)?.[0]
    if (tail && layout.letter.test(Array.from(to).pop() ?? "")) {
      const kept = toLayout(word.slice(0, -tail.length), layout) + tail
      if (plausibility(layout.fold(trimTo(kept, layout.letter)), layout.model) > plausibility(layout.fold(trimTo(to, layout.letter)), layout.model)) to = kept
    }
    const meant = layout.fold(trimTo(to, layout.letter))
    if (!meant || layout.impossible.test(meant)) return null
    const margin = plausibility(meant, layout.model) - plausibility(letters, ENGLISH_MODEL)
    return { index, from: word, to, margin, letters: Array.from(meant).length }
  }
  // Keys that type punctuation here but letters in English (Hebrew w → ') belong to the word.
  const { latin: keys } = keyMaps(layout)
  const core = trimTo(word, { test: (char: string) => layout.letter.test(char) || /[a-z]/.test(keys.get(char) ?? "") })
  if (layout.native?.test(core)) return null
  const typed = layout.fold(core)
  const latin = fromLayout(core, layout)
  if (!typed || (layout.shiftLetters && !NATURAL_CASE(latin))) return null
  // Keep punctuation a native letter turned into at the start ("эффект" → "'aatrn"): no English word begins that way.
  const meant = latin.replace(/(?<=[a-z])'(?=[a-z])|[.,;:!?'"]+$/gi, "").toLowerCase()
  const to = word.replace(core, latin)
  let margin = plausibility(meant, ENGLISH_MODEL) - plausibility(typed, layout.model)
  // Impossible spelling is strong evidence; without it, InScript needs extra proof (its bigrams are spread thin).
  if (layout.impossible.test(typed)) margin += 2
  else if (layout.shiftLetters) margin -= 2
  return { index, from: word, to, margin, letters: Array.from(meant).length }
}

// Thresholds in bits per bigram, tuned on held-out Wikipedia text: no real word in ~5,000 per language was
// flagged, and fresh text flagged 1 of ~3,400 real sentences while catching 94–99% of mistyped ones.
const PHRASE_MARGIN = 1.5
const wordMargin = (letters: number) => (letters <= 3 ? 4 : letters === 4 ? 2.75 : 2.2)

function decide(candidates: Candidate[]) {
  const long = candidates.filter((c) => c.letters >= 3)
  let flagged = long.filter((c) => c.margin > wordMargin(c.letters))
  // Several words leaning the same way are convincing together even when each is borderline.
  const leaning = long.filter((c) => c.margin > 0)
  if (leaning.length >= 2 && long.reduce((sum, c) => sum + c.margin, 0) / long.length > PHRASE_MARGIN) flagged = leaning
  if (!flagged.length) return []
  // Pull in neighbours that read better converted, and short ones ("nen" → "тут") that aren't clearly English.
  const picked = new Set(flagged)
  for (let changed = true; changed; ) {
    changed = false
    candidates.forEach((c, i) => {
      if (picked.has(c) || c.margin <= (c.letters <= 3 ? -2 : 0)) return
      if (picked.has(candidates[i - 1]) || picked.has(candidates[i + 1])) {
        picked.add(c)
        changed = true
      }
    })
  }
  return candidates.filter((c) => picked.has(c))
}

/**
 * Finds words typed with the wrong keyboard layout ("ghbdtn" meant "привет", "руддщ" meant "hello")
 * and returns the text retyped, or null when nothing looks wrong.
 */
export function detectWrongLayout(text: string, layouts: KeyboardLayout[] = KEYBOARD_LAYOUTS, ignore: string[] = []): LayoutFix | null {
  const skip = new Set(ignore.map((word) => word.toLowerCase()))
  const words = [...text.matchAll(/\S+/g)].filter((m) => !SKIP.test(m[0]) && !skip.has(m[0].replace(/^\p{P}+|\p{P}+$/gu, "").toLowerCase()))
  let best: { fix: LayoutFix; score: number } | null = null
  for (const layout of layouts) {
    for (const direction of ["toLayout", "toLatin"] as const) {
      // A word belongs to one side only: Latin letters and nothing of the layout's script, or the reverse.
      // Words with letters of any other script (Zəfər, Jáchym) are left alone.
      const own = words.filter(({ 0: word }) => {
        const letters = word.match(/[\p{L}\p{M}]/gu) ?? []
        return direction === "toLayout"
          ? letters.length > 0 && letters.every((char) => LATIN.test(char))
          : letters.some((char) => layout.letter.test(char)) &&
              letters.every((char) => layout.letter.test(char) || (!layout.shift && /[A-Z]/.test(char))) &&
              !/[A-Z]{2}/.test(word) // a Latin acronym inside (ה-WWF) was typed on purpose
      })
      const candidates = own.flatMap((m) => candidate(m[0], m.index, layout, direction) ?? [])
      const chosen = decide(candidates)
      const score = chosen.reduce((sum, c) => sum + c.margin, 0)
      if (!chosen.length || (best && best.score >= score)) continue
      let fixed = text
      for (const c of [...chosen].reverse()) fixed = fixed.slice(0, c.index) + c.to + fixed.slice(c.index + c.from.length)
      best = { score, fix: { layout, direction, text: fixed, changes: chosen.map(({ index, from, to }) => ({ index, from, to })) } }
    }
  }
  return best?.fix ?? null
}
