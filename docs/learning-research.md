# How to learn 2,000 words in a month: the research behind the planner

This note explains why the app's study plan works the way it does. Each section gives a finding, the paper it comes from, and what the app does with it.

## What the research says

### 1. Recall the word, do not reread it (retrieval practice)

Karpicke and Roediger (2008) had students learn 40 Swahili–English word pairs. Students who kept being *tested* on every pair recalled about 80% a week later. Students who kept *rereading* the pairs but stopped being tested on the ones they knew recalled about 33–36%. More study time after a word was known did nothing; more recall did. Students also could not tell which method worked: their predictions were the same for both.

- Karpicke, J. D., & Roediger, H. L. (2008). The critical importance of retrieval for learning. *Science, 319*(5865), 966–968. https://doi.org/10.1126/science.1152408

**In the app:** every card asks first (pick the meaning, pick it by ear, or type it) and shows the answer after. There is no "read the list" mode in the study session.

### 2. Space the reviews, and let the gaps grow (spacing)

Cepeda et al. (2008) tested more than 1,350 people with gaps of up to 3.5 months between two study sessions and tests up to a year later. The best gap depends on how long you want to remember: about 20–40% of the retention interval for a one-week test, falling to about 5–10% for a one-year test. Too short a gap is worse than a gap that is a bit too long.

Kornell (2009) compared the same flashcards studied in one large spaced stack against small massed stacks. Spacing was better for about 90% of the participants, yet most of them believed cramming had worked better.

FSRS (Ye, Su & Cao, 2022) is a scheduler trained on millions of real flashcard reviews. It predicts, per word and per learner, when the chance of recall falls to a target (90% here), and schedules the next review then.

- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Kornell, N. (2009). Optimising learning using flashcards: Spacing is more effective than cramming. *Applied Cognitive Psychology, 23*(9), 1297–1317. https://doi.org/10.1002/acp.1537
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining (KDD 2022)*. FSRS code: https://github.com/open-spaced-repetition

**In the app:** FSRS picks every review date from your answers. The plan only decides which new words arrive each day; it never forces reviews on a fixed calendar.

### 3. Relearn to criterion, again and again (successive relearning)

Successive relearning combines the two ideas above: in each session you keep recalling an item until you get it right, and you repeat that over several spaced sessions. Rawson, Dunlosky and Sciartelli (2013) used it in a real college course and found large gains on exams and on retention weeks later, and later sessions took much less time than the first.

- Rawson, K. A., Dunlosky, J., & Sciartelli, S. M. (2013). The power of successive relearning: Improving performance on course exams and long-term retention. *Educational Psychology Review, 25*(4), 523–548. https://doi.org/10.1007/s10648-013-9240-4

**In the app:** a missed word comes back in the same session (learning steps) until you answer it, and then on later days.

### 4. Do not learn a topic's words all together (semantic clustering)

Learning a set of related words at the same time (ten clothing words, or all the body parts) makes them interfere: learners mix them up. Tinkham (1993) found that related sets took longer to learn than unrelated ones, and Nakata and Suzuki (2019) found more interference errors for related sets, with spacing helping on the delayed test.

- Tinkham, T. (1993). The effect of semantic clustering on the learning of second language vocabulary. *System, 21*(3), 371–380.
- Nakata, T., & Suzuki, Y. (2019). Effects of massing and spacing on the learning of semantically related and unrelated words. *Studies in Second Language Acquisition, 41*(2), 287–311. https://doi.org/10.1017/S0272263118000219

**In the app:** the study images are organized by topic, so the plan shuffles each group and, in the default "Mixed" order, interleaves the image words with common words. A day never holds a whole topic.

### 5. Learn the most useful words, in context, out loud

Nation (2013) argues that the most frequent words give by far the most return for a learner's time, and that knowing a word includes knowing how it is used, not only its translation. Saying a word aloud also helps: words read aloud are remembered better than words read silently (the production effect; MacLeod et al., 2010).

- Nation, I. S. P. (2013). *Learning Vocabulary in Another Language* (2nd ed.). Cambridge University Press.
- MacLeod, C. M., Gopie, N., Hourihan, K. L., Neary, K. R., & Ozubko, J. D. (2010). The production effect: Delineation of a phenomenon. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 36*(3), 671–685. https://doi.org/10.1037/a0018785

**In the app:** the 1,000 words that are not from the images come from the TOPIK I list of everyday words. Every word has two short Korean example sentences with a Hindi translation, shown after you answer, and each sentence has a play button to hear it and repeat it.

## Brainstorm: what was considered

| Idea | Kept? | Why |
|---|---|---|
| Fixed review calendar (review on days 1, 3, 7, 14, 30) | Only for the time estimate | FSRS adapts the gaps per word, which needs fewer reviews for the same recall |
| Learn the images day by day, as they are | No, by default | Topic clusters cause interference; "My image words first" is still offered |
| Same number of new words every day, no matter what | No | Missed days would pile up; the plan shares the words left over the days left, up to twice the normal pace |
| Show example sentences before the question | No | Testing first, then showing the answer with context, keeps the benefit of retrieval |
| Cap the plan at a "comfortable" size | No, but warn | 2,000 words in 30 days is about 67 new words a day and roughly 60–95 minutes on most days. The planner shows the load and suggests more days if it is too heavy |
| Sentence highlighting of the word | Yes, best effort | It helps spot the word; irregular forms (듣다 → 들어요) are simply not highlighted |

## The numbers for 2,000 words in 30 days

- New words: 66–67 a day.
- Each new word costs about 40 seconds the first day (question, answer, two examples, one or two quick repeats) and about 10 seconds per later review.
- Reviews are estimated from typical FSRS gaps (about 1, 3, 7, 15 and 30 days after learning) plus 10% for forgotten words. They build up through the first two weeks.
- Result: about 45 minutes on day 1, about 60–70 minutes in the first week, and about 80–95 minutes a day from week three. That is heavy but possible with daily study. 45 or 60 days roughly halves the load per day.

## The word list

- `data/plan/day-01.txt` … `day-20.txt`: 1,001 words read from the 20 study images. Repeats are dropped, phrases are reduced to dictionary forms, and mistakes in the images are corrected; each file's header lists what changed.
- `data/plan/fill-01.txt` … `fill-09.txt`: 999 common words. Parts 1–7 come from the TOPIK I list in `data/ko_hi_en_vocab.csv` (proper nouns, polite set phrases and simple compounds are left out); parts 8–9 add everyday words that list is missing (편의점, 궁금하다, 혹시, 갑자기 …).
- Format, one word per line: `Korean|romanization|Hindi|English|example 1 Korean|example 1 Hindi|example 2 Korean|example 2 Hindi`. A `#2` after the Korean marks a second word with the same spelling (눈 snow, 눈#2 eye).
