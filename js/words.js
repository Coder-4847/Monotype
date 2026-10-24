// Word lists and quotes. Lowercase letters only, so every word is easy to type.

const COMMON = `the be of and to in he have it that for they with as not on she at by this we you do but from or which
one would all will there say who make when can more if no man out other so what time up go about than into could
state only new year some take come these know see use get like then first any work now may such give over think
most even find day also after way many must look before great back through long where much should well people down
own just because good each those feel seem how high too place little world very still nation hand old life tell
write become here show house both between need mean call develop under last right move thing general school never
same another begin while number part turn real leave might want point form off child few small since against ask
late home interest large person end open public follow during present without again hold around possible head
consider word program problem however lead system set order eye plan run keep face fact group play stand increase
early course change help line put important country`;

const MORE = `able above accept across act add afraid age ago agree air allow almost alone along already always among amount
animal answer appear area arm art attack away baby bad bag ball bank bar base beautiful bed behind believe belong
best better big bird bit black blood blue board boat body bone book born bottom box boy break bright bring brother
build burn business buy car card care carry case catch cause center century certain chair chance character check
choose church circle city class clean clear close cloud cold color company compare complete condition contain
control cook cool copy corner cost count country couple cover cross crowd cry cut dark daughter dead dear decide
deep describe design die difference different difficult dinner direct discover distance doctor dog door double
doubt draw dream dress drink drive drop dry earth east easy eat edge effect egg else energy enough enter equal
evening event ever every exactly example expect experience explain fall family far farm fast father fear field
fight figure fill final fine finger finish fire fish five floor flower fly food foot force foreign forest forget
forward four free friend front full future game garden gather gold gone grass gray green ground grow guess gun
hair half happen happy hard hat hear heart heavy held hill history hit hope horse hot hour huge human hundred
hurt ice idea inch include instead iron island job join joy jump kind king kitchen knew lady lake land language
laugh law lay learn least leg length less letter level lie light lip list listen live local lonely lose lost lot
loud love low machine main manage map mark market matter measure meet member middle mile milk mind minute miss
modern moment money month moon morning mother mountain mouth music name nature near neck neighbor news night nine
noise none north nose note nothing notice object ocean often oil once opinion pair paper parent park party pass
past pay peace pick picture piece plain plant please pocket poem police poor pool power prepare press pretty
prince print prove pull push quality question quick quiet quite race rain raise reach read ready reason receive
record red remember rest result return rich ride ring rise river road rock roll room root rose round rule safe
sail salt sand save science sea season seat second secret seed sell send sense sentence separate serve seven
several shape share sharp sheep shine ship shoe shop shore short shoulder shout side sight sign silent silver
simple sing sister sit six size skin sky sleep slow smell smile snow soft soil soldier son song soon sort sound
south space speak special speed spend spoke spread spring square star start station stay steel step stick stone
stop store storm story straight strange stream street strong student study subject success sudden sugar suit
summer sun supply sure surface surprise sweet swim table tail talk tall teach team tear ten test thank thick thin
third thought thousand three throw thus tie tiny tire together tomorrow tone tonight tool top total touch toward
town trade train travel tree trip trouble truck true try twenty two type uncle understand unit until upon usual
valley value various view village visit voice wait walk wall war warm wash watch water wave weather week weight
west wet wheel white whole wide wife wild win wind window winter wire wise wish woman wonder wood wool worry
worth wrong yard yellow yes yesterday young youth zero abstract access achieve action active actual address adult
advance advice affect agency agent album alert anger announce annual anxiety appeal apply approach argue arrive
article artist assume attempt attend audience author average avoid awake award balance basic battle beach beauty
benefit beyond bill birth blame blind block bold border borrow bother brain branch brave bread breath bridge
brief broad broken brown brush budget burden butter button cabin cable camera camp canvas capital captain carbon
career carpet cash castle central chain challenge channel chapter charge charity chart cheap chest chief choice
citizen claim classic climb clock cloth coach coast coffee collect college column comfort command comment
compete complex concept concern concert connect context contract convince copper cotton courage court cousin
crack craft crash create credit crime crisis critic crop curious current curve custom cycle damage danger data
debate decade deliver demand depend depth desert desire detail device diet dig digital discuss disease display
divide document dollar domestic dozen draft drama drawer drift due duty eager earn educate elect element empty
enable encourage engine enjoy entire escape essay estate evidence exact exchange exercise exist expand expert
explore express extend extra fabric factor fail faith false fame fancy fashion fault favor feature federal fee
female fence festival fiber fiction film finance firm flag flame flat flight fluid focus fold folk fool fork
formal formula fortune frame freedom fresh frozen fuel function fund funny gain gallery gap gate gear gentle
gift glad glass global glory goal grace grade grain grand grant graph grateful grave guard guest guide habit
hammer handle harbor harm harvest hate heal health heat height helmet hidden holiday honest honor host hotel
household humor hunt hurry identity image impact import improve income index industry inner insect inside insist
inspire install intend invite issue item jacket jewel journal journey judge juice jungle junior justice keen key
kid kiss knee knife knock label labor ladder lamp launch lawn layer leader leaf lecture legal lemon lend lens
lesson liberty library license lift limit link liquid lock logic lunch magic major marble march marry master
match material maybe meal meaning medal medical melt memory mental mention mercy merge message metal method
mild mirror mission mistake mix model monitor mood moral motion motor movie murder muscle museum mystery narrow
native navy nerve network nobody noble normal novel nurse oak obey observe obtain occur offer office officer
online option orange organ origin outer oven owner pace pack page pain paint palace panel parade partner patch
path patient pattern pause peak pencil pepper period permit phone phrase pilot pine pipe pitch planet plastic
plate pleasure plenty plot poetry polite pond popular port pose potato pour powder practice praise prayer prefer
pride priest prison private prize process produce profit project promise proof proper protect proud provide
pump punish pupil purple purpose puzzle quarter queen quote radio rail range rapid rare rate rather raw razor
reader reality recall recent recipe reduce reflect refuse region regret relax release relief rely remain remove
rent repair repeat reply report rescue reserve resist resource respect rhythm ribbon rice ridge rough route
royal rubber rural rush sacred sad saddle sample satisfy scale scene schedule scheme score screen script search
secure select senior series settle shadow shallow shelf shell shift shirt shock shower signal silk single skill
slice slide slight smart smoke smooth snake social software solid solve somewhere spare spell spirit split sport
spot stable staff stage stair stamp standard steady steep stir stock strap straw stress stretch strike string
strip structure style summit sunset support swing symbol tale talent target taste tax teacher tender tent term
texture theme theory thread throat thunder ticket tide tight timber title toast tongue tower trace track trail
transfer trap treasure treat trend trial tribe trick truth tube tune tunnel twist unique unite universe upper
urban useful valid vast vegetable vehicle venture version vessel victory vision visual vital volume vote wage
wagon warn waste wealth weapon weave wedding welcome wheat whisper whistle width wing wisdom witness worker
yield zone`;

const split = (s) => s.split(/\s+/).filter(Boolean);
const unique = (list) => [...new Set(list)];

/** The 200 most common words, for an easy test. */
export const COMMON_200 = unique(split(COMMON));

/** A broader pool of 1000 words (the common 200 plus 800 more). */
export const TOP_1000 = unique([...COMMON_200, ...split(MORE)]).slice(0, 1000);

/** Short public-domain quotes. ASCII punctuation only, so they are easy to type. */
export const QUOTES = [
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'I think, therefore I am.', author: 'Rene Descartes' },
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'All that glitters is not gold.', author: 'William Shakespeare' },
  { text: 'To be, or not to be, that is the question.', author: 'William Shakespeare' },
  { text: 'Knowledge itself is power.', author: 'Francis Bacon' },
  { text: 'Fortune favors the bold.', author: 'Virgil' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Slow and steady wins the race.', author: 'Aesop' },
  { text: 'The pen is mightier than the sword.', author: 'Edward Bulwer-Lytton' },
  { text: 'It was the best of times, it was the worst of times.', author: 'Charles Dickens' },
  { text: 'All happy families are alike; each unhappy family is unhappy in its own way.', author: 'Leo Tolstoy' },
  { text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', author: 'Jane Austen' },
  { text: 'We are all in the gutter, but some of us are looking at the stars.', author: 'Oscar Wilde' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Courage is resistance to fear, mastery of fear, not absence of fear.', author: 'Mark Twain' },
  { text: 'I am not afraid of storms, for I am learning how to sail my ship.', author: 'Louisa May Alcott' },
  { text: 'Hope is the thing with feathers that perches in the soul.', author: 'Emily Dickinson' },
  { text: 'Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.', author: 'Robert Frost' },
  { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { text: 'Genius is one percent inspiration and ninety-nine percent perspiration.', author: 'Thomas Edison' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
  { text: 'Nothing in life is to be feared, it is only to be understood.', author: 'Marie Curie' },
  { text: 'The only thing we have to fear is fear itself.', author: 'Franklin D. Roosevelt' },
  { text: 'Whatever you are, be a good one.', author: 'Abraham Lincoln' },
  { text: 'Never put off till tomorrow what you can do today.', author: 'Proverb' },
  { text: 'Actions speak louder than words.', author: 'Proverb' },
  { text: 'Brevity is the soul of wit.', author: 'William Shakespeare' },
  { text: 'Simple things should be simple and complex things should be possible.', author: 'Alan Kay' },
];
