/** Words common in hashtags, used to split all-lowercase tags into CamelCase. Extend via the `words` prop. */
export const HASHTAG_WORDS = `
a about access accessible after ai all and app apps art as at award awards back bank be beauty best big black blog book
books brand build building business buy by care career change city clean climate cloud club code coding community content
cook cooking craft creative cricket culture cup daily data day deal debt design designer dev developer devops diary diet
digital dinner diwali dog dream drink earth eat eco edu education end energy event every face fact fair fall family fan
fashion fast feel fest festival film finance first fit fitness follow food for free fresh friday friend friends front full fun
future game games gaming get girl give global go good great green grow growth hack hackathon hair happy health healthy help
her his home hour house how in india indie inspo is it job jobs just kid kids kitchen learn learning life like little live
local look love made make maker market marketing me media meet mental mind mobile model monday money month morning motivation
music my nature need new news next night no now of off on one online open or our out over own page paid party people pet
photo photography plan plant play post power pride product program project pune quote read ready real recipe remote report
research run sale save school science season security self sell share shop show side skill skills small social software
source space sport sports spring stack start startup stay step store story strong student study style summer sunday support
sustainable take talk team tech the thing think this time tip tips to today top travel trip true tuesday up us use vegan
video view vibes vote walk war water way we web week weekend well wellness what win winter with women work workout world
write writer writing year yoga you young your
`.trim().split(/\s+/)

/**
 * Splits an all-lowercase run into dictionary words with the fewest pieces
 * ("opensource" → ["open", "source"]). Digit runs count as one word.
 * Returns null when any part isn't a known word.
 */
export function segmentWords(text: string, words: Set<string>): string[] | null {
  const best: (string[] | null)[] = [[]]
  for (let end = 1; end <= text.length; end++) {
    best[end] = null
    for (let start = Math.max(0, end - 20); start < end; start++) {
      const prev = best[start]
      const piece = text.slice(start, end)
      if (!prev || !(words.has(piece) || /^\d+$/.test(piece))) continue
      if (!best[end] || prev.length + 1 < best[end]!.length) best[end] = [...prev, piece]
    }
  }
  return best[text.length]
}
