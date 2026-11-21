/**
 * Sample data so everything can be tried at once:
 *   accounts  demo / demo1234 (admin)   ravi / ravi1234
 *   decks     KR24 Korean   ES25 Spanish   HN26 Hindi   JP27 Japanese (by ravi)
 * Run `npm run reset` first to start from an empty database.
 */
import { loadConfig } from './config';
import { createContainer } from './container';
import { defaultScriptMeta } from '../core/script';
import type { NewCard } from './ports';
import type { RuleOverrides } from '../core/rules';

const config = loadConfig();
const c = createContainer({ dbFile: config.dbFile, mediaDir: config.mediaDir });

/** term|reading|meaning|meaning 2|example|example translation */
function cards(lines: string, prompts: Record<string, string> = {}): NewCard[] {
  return lines
    .trim()
    .split('\n')
    .map((l) => {
      const [term, reading, meaning, meaningAlt, ex, tr, ex2, tr2] = l.split('|').map((s) => s.trim());
      const examples = [{ text: ex, translation: tr }];
      if (ex2) examples.push({ text: ex2, translation: tr2 });
      return { term, reading, meaning, meaningAlt: meaningAlt || undefined, examples, writingPrompt: prompts[term] };
    });
}

const KOREAN = cards(
  `
물|mul|पानी|water|물 좀 주세요.|थोड़ा पानी दीजिए।|저는 매일 물을 많이 마셔요.|मैं रोज़ बहुत पानी पीता हूँ।
친구|chingu|दोस्त|friend|그는 제 친구예요.|वह मेरा दोस्त है।|주말에 친구를 만나요.|मैं सप्ताहांत में दोस्त से मिलता हूँ।
학교|hakgyo|स्कूल|school|아이가 학교에 가요.|बच्चा स्कूल जाता है।|우리 학교는 집에서 가까워요.|हमारा स्कूल घर के पास है।
책|chaek|किताब|book|이 책은 재미있어요.|यह किताब दिलचस्प है।|저는 밤에 책을 읽어요.|मैं रात को किताब पढ़ता हूँ।
집|jip|घर|house, home|저는 지금 집에 있어요.|मैं अभी घर पर हूँ।|우리 집은 아주 작아요.|हमारा घर बहुत छोटा है।
음식|eumsik|खाना, भोजन|food|한국 음식을 좋아해요.|मुझे कोरियाई खाना पसंद है।|이 음식은 너무 매워요.|यह खाना बहुत तीखा है।
우유|uyu|दूध|milk|아이가 우유를 마셔요.|बच्चा दूध पी रहा है।|우유가 냉장고에 있어요.|दूध फ्रिज में है।
가다|gada|जाना|to go|저는 학교에 가요.|मैं स्कूल जाता हूँ।|내일 시장에 갈 거예요.|कल मैं बाज़ार जाऊँगा।
오다|oda|आना|to come|친구가 집에 와요.|दोस्त घर आ रहा है।|언제 한국에 왔어요?|आप कोरिया कब आए?
먹다|meokda|खाना|to eat|저는 김치를 먹어요.|मैं किमची खाता हूँ।|아침을 먹었어요?|नाश्ता किया?
마시다|masida|पीना|to drink|물을 마시고 싶어요.|मुझे पानी पीना है।|저는 커피를 안 마셔요.|मैं कॉफ़ी नहीं पीता।
보다|boda|देखना|to see, to watch|영화를 봤어요.|मैंने फ़िल्म देखी।|저 산을 보세요.|उस पहाड़ को देखिए।
길다|gilda|लंबा|long|머리가 길어요.|बाल लंबे हैं।|겨울에는 밤이 길어요.|सर्दियों में रातें लंबी होती हैं।
아름답다|areumdapda|सुंदर|beautiful|경치가 정말 아름다워요.|नज़ारा सच में सुंदर है।|아름다운 노래네요.|कितना सुंदर गाना है।
`,
  { 친구: 'Write one sentence about your friend using 친구.', 먹다: 'Write what you ate today, using 먹다.' }
);

const SPANISH = cards(`
hola|OH-lah|hello||¡Hola! ¿Qué tal?|Hi! How are you?
gracias|GRAH-syahs|thank you, thanks||Muchas gracias por todo.|Thanks a lot for everything.
agua|AH-gwah|water||Quiero un vaso de agua.|I want a glass of water.
estación|es-tah-SYON|station||¿Dónde está la estación?|Where is the station?
mañana|mah-NYAH-nah|tomorrow, morning||Nos vemos mañana.|See you tomorrow.
cuenta|KWEN-tah|bill, check||La cuenta, por favor.|The bill, please.
baño|BAH-nyoh|bathroom||¿Dónde está el baño?|Where is the bathroom?
billete|bee-YEH-teh|ticket||Necesito un billete de tren.|I need a train ticket.
habitación|ah-bee-tah-SYON|room||Tengo una habitación reservada.|I have a room booked.
izquierda|ees-KYEHR-dah|left||Gire a la izquierda.|Turn left.
derecha|deh-REH-chah|right (direction)||El hotel está a la derecha.|The hotel is on the right.
ayuda|ah-YOO-dah|help||¡Necesito ayuda!|I need help!
`);

const HINDI = cards(`
पानी|paani|water||मुझे पानी चाहिए।|I need water.
घर|ghar|house, home||मेरा घर बड़ा है।|My house is big.
दोस्त|dost|friend||वह मेरा दोस्त है।|He is my friend.
किताब|kitaab|book||यह किताब नई है।|This book is new.
दिन|din|day||आज अच्छा दिन है।|Today is a good day.
रात|raat|night||रात को चाँद दिखता है।|The moon shows at night.
बड़ा|bada|big||यह कमरा बड़ा है।|This room is big.
छोटा|chhota|small||मेरा भाई छोटा है।|My brother is small.
खाना|khaana|food; to eat||खाना बहुत स्वादिष्ट है।|The food is very tasty.
सुंदर|sundar|beautiful||यह फूल सुंदर है।|This flower is beautiful.
`);

const JAPANESE = cards(`
みず|mizu|water||みずをください。|Water, please.
ねこ|neko|cat||ねこがすきです。|I like cats.
いぬ|inu|dog||いぬがはしっています。|The dog is running.
ほん|hon|book||このほんはおもしろい。|This book is interesting.
がっこう|gakkou|school||がっこうにいきます。|I go to school.
ともだち|tomodachi|friend||ともだちとあそびます。|I play with friends.
たべる|taberu|to eat||すしをたべる。|I eat sushi.
のむ|nomu|to drink||おちゃをのむ。|I drink tea.
いく|iku|to go||あしたいく。|I will go tomorrow.
みる|miru|to see, to watch||テレビをみる。|I watch TV.
`);

async function account(username: string, password: string, displayName: string) {
  const existing = await c.stores.users.getByUsername(username);
  if (existing) return existing;
  const s = await c.auth.register({ username, password, displayName });
  return (await c.stores.users.getById(s.user.id))!;
}

async function deck(ownerId: string, code: string, input: { title: string; description: string; targetLang: string; sourceLang: string; altLang?: string; rules?: RuleOverrides; branding?: object }, list: NewCard[]) {
  if (await c.stores.decks.codeExists(code)) return console.log(`  ${code} already there`);
  const creator = (await c.stores.creators.getByOwner(ownerId))!;
  const d = await c.stores.decks.create({
    creatorId: creator.id,
    code,
    title: input.title,
    description: input.description,
    targetLang: input.targetLang,
    sourceLang: input.sourceLang,
    altLang: input.altLang,
    scriptMeta: defaultScriptMeta(input.targetLang),
    ruleOverrides: input.rules ?? {},
    branding: input.branding ?? {},
    visibility: 'public',
  });
  await c.stores.decks.replaceCards(d.id, list);
  console.log(`  ${code}  ${input.title} (${list.length} cards)`);
}

const demo = await account('demo', 'demo1234', 'Demo Teacher');
await c.stores.users.update(demo.id, { role: 'admin' });
const demoCreator = (await c.stores.creators.getByOwner(demo.id))!;
await c.stores.creators.update(demoCreator.id, { displayName: 'Demo Teacher', branding: { title: 'Demo Teacher', note: 'Sample decks to try every mode', badge: 'DEMO', color: '#0f766e' } });

const ravi = await account('ravi', 'ravi1234', 'Ravi Sensei');
const raviCreator = (await c.stores.creators.getByOwner(ravi.id))!;
await c.stores.creators.update(raviCreator.id, { branding: { title: 'Japanese with Ravi', note: 'New words every Friday', badge: 'N5', color: '#be123c' } });

console.log('Decks:');
await deck(demo.id, 'KR24', { title: 'Korean: first 14 words', description: 'Everyday Korean words with Hindi and English meanings and two example sentences each.', targetLang: 'ko', sourceLang: 'hi', altLang: 'en', branding: { badge: 'TOPIK I', note: 'Day 1 words' } }, KOREAN);
await deck(demo.id, 'ES25', { title: 'Spanish for travel', description: 'Words you need at the station, hotel and restaurant.', targetLang: 'es', sourceLang: 'en', rules: { answerStyle: 'options', writing: { level: 'strict' } } }, SPANISH);
await deck(demo.id, 'HN26', { title: 'Hindi starter', description: 'Ten common Hindi words in Devanagari.', targetLang: 'hi', sourceLang: 'en', rules: { reading: { hints: 'off' } } }, HINDI);
await deck(ravi.id, 'JP27', { title: 'Japanese: hiragana words', description: 'First words written in hiragana.', targetLang: 'ja', sourceLang: 'en', rules: { targetReps: 1, reading: { hints: 'show' } } }, JAPANESE);

console.log('\nAccounts: demo / demo1234 (admin), ravi / ravi1234');
c.close();
