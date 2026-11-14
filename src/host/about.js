/**
 * About-tab facts with package.json as the single version source.
 *
 * v1.5 host split: implementation moved verbatim from the index.js monolith.
 */
import { readFileSync } from 'node:fs'
import { PACKAGE_FILE } from './constants.js'
import { cleanText, cleanUrl } from './sanitize.js'

const FALLBACK_ABOUT = {
  version: '1.6.0',
  homepage: 'https://github.com/CVEO/dsh-digital-earth',
  issues: 'https://github.com/CVEO/dsh-digital-earth/issues',
  team: { name: '武汉大学 CVEO 课题组', url: 'https://www.whu-cveo.com/' },
}

/**
 * About-tab facts for the client. package.json is the single source of the
 * version, so a release bump needs no code edit; constants cover a checkout
 * whose package file is missing or malformed.
 */
function readAbout() {
  let record = {}
  try {
    const parsed = JSON.parse(readFileSync(PACKAGE_FILE, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) record = parsed
  } catch {
    record = {}
  }
  const version = cleanText(record.version, 32)
  const homepage = cleanUrl(record.homepage)
  const team = record.team !== null && typeof record.team === 'object' ? record.team : {}
  const teamName = cleanText(team.name, 60)
  const teamUrl = cleanUrl(team.url)
  return {
    version: version !== '' ? version : FALLBACK_ABOUT.version,
    homepage: homepage !== '' ? homepage : FALLBACK_ABOUT.homepage,
    // Not a package.json field of this plugin: the repository issues page is a
    // fixed fact, so the About tab does not depend on the publish metadata.
    issues: FALLBACK_ABOUT.issues,
    team: {
      name: teamName !== '' ? teamName : FALLBACK_ABOUT.team.name,
      url: teamUrl !== '' ? teamUrl : FALLBACK_ABOUT.team.url,
    },
  }
}

export const ABOUT = readAbout()
