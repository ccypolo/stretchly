import VersionChecker from './utils/versionChecker.js'
import { setSameWidths } from './utils/sameWidths.js'
import HtmlTranslate from './utils/htmlTranslate.js'

import './platform.js'

const versionChecker = new VersionChecker()
let eventsAttached = false

window.onload = async (e) => {
  const bounds = await window.stretchly.getWindowBounds()
  const settings = await window.settings.currentSettings()
  if (settings.disableAppUpdateFeatures) {
    document.querySelector('#checkNewVersion').closest('div').classList.add('hidden')
  }

  if (settings.hideStrictModePreferences) {
    document.querySelectorAll('[data-strict-mode]').forEach(element => {
      element.classList.add('hidden')
    })
    document.querySelector('#enablePostponeLong').closest('div').style.marginBottom = '56px'
  }

  if (settings.hidePreferencesFileLocation) {
    document.querySelectorAll('[data-preferences-file]').forEach(element => {
      element.classList.add('hidden')
    })
  }

  new HtmlTranslate(document).translate()
  setWindowHeight()
  setTimeout(() => { eventsAttached = true }, 500)

  if (settings.customPreferencesMessage) {
    const customMessageDiv = document.createElement('div')
    customMessageDiv.className = 'custom-message'
    customMessageDiv.textContent = settings.customPreferencesMessage
    document.querySelector('.navigation').parentNode.insertBefore(customMessageDiv, document.querySelector('.navigation').nextSibling)
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    imagesWithDarkVersion.forEach(image => {
      // replace last occurance https://github.com/electron-userland/electron-builder/issues/5152
      const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
      image.src = newSource
    })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    if (event.matches) {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
        image.src = newSource
      })
    } else {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace('-dark.', '.')
        image.src = newSource
      })
    }
  })

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.onkeydown = async event => {
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      const [
        reference, timeleft, breaknumber,
        postponesnumber, settingsfile, logsfile, doNotDisturb, imagesfolder
      ] = await window.stretchly.showDebug()
      const debugInfo = document.querySelector('.debug > :first-child')
      if (!debugInfo.classList.contains('hidden')) {
        debugInfo.classList.add('hidden')
      } else {
        debugInfo.classList.remove('hidden')
        document.querySelector('#reference').innerHTML = reference
        document.querySelector('#timeleft').innerHTML = timeleft
        document.querySelector('#breakNumber').innerHTML = breaknumber
        document.querySelector('#postponesNumber').innerHTML = postponesnumber
        document.querySelector('#settingsfile').innerHTML = settingsfile
        document.querySelector('#logsfile').innerHTML = logsfile
        document.querySelector('#imagesfolder').innerHTML = imagesfolder
        document.querySelector('#donotdisturb').innerHTML = doNotDisturb
        document.querySelector('#node').innerHTML = await window.runtime.node()
        document.querySelector('#chrome').innerHTML = await window.runtime.chrome()
        document.querySelector('#electron').innerHTML = await window.runtime.electron()
        document.querySelector('#platform').innerHTML = await window.runtime.platform()
        document.querySelector('#windowsStore').innerHTML = await window.runtime.windowsStore() || false
        document.querySelector('#windowsPortable').innerHTML = await window.runtime.windowsPortable() || false
      }
      setWindowHeight()
    }
  }

  window.stretchly.onTranslate(async () => {
    new HtmlTranslate(document).translate()
    document.querySelectorAll('input[type="range"]').forEach(async range => {
      const settings = await window.settings.currentSettings()
      const divisor = range.dataset.divisor
      const output = range.closest('div').querySelector('output')
      range.value = settings[range.name] / divisor
      const unit = output.dataset.unit
      output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
      document.querySelector('#longBreakEvery').closest('div').querySelector('output')
        .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    })
    setWindowHeight()
  })

  window.stretchly.onEnableContributorPreferences(() => {
    showContributorPreferencesButton()
  })

  const showContributorPreferencesButton = () => {
    document.querySelectorAll('.contributor').forEach((item) => {
      item.classList.remove('hidden')
    })
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.add('hidden')
    })
    setWindowHeight()
  }

  if (await window.global.getValue('isContributor')) {
    showContributorPreferencesButton()
  }

  document.querySelector('[name="contributorPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openContributorPreferences()
  }

  document.querySelector('[name="syncPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openSyncPreferences()
  }

  document.querySelector('.debug button').onclick = async (event) => {
    event.preventDefault()
    const toCopy = document.querySelector('#to-copy')
    await navigator.clipboard.writeText(toCopy.textContent)
    const copiedEl = document.createElement('span')
    copiedEl.innerHTML = ' copied!'
    event.target.parentNode.appendChild(copiedEl)
    setTimeout(() => copiedEl.remove(), 1275)
  }

  document.querySelectorAll('.navigation a').forEach(element => {
    element.onclick = event => {
      event.preventDefault()
      event.target.closest('.navigation').childNodes.forEach(link => {
        if (link.classList) {
          link.classList.remove('active')
        }
      })
      event.target.closest('a').classList.add('active')

      const toBeDisplayed = document.querySelector(`.${event.target.closest('[data-section]').getAttribute('data-section')}`)
      document.querySelectorAll('body > div:not(.custom-message)').forEach(section => {
        if (section !== toBeDisplayed) {
          section.classList.add('hidden')
        } else {
          section.classList.remove('hidden')
        }
      })

      setSameWidths()
      setWindowHeight()
    }
  })

  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    const isNegative = checkbox.classList.contains('negative')
    checkbox.checked = isNegative ? !settings[checkbox.value] : settings[checkbox.value]
    if (!eventsAttached) {
      checkbox.onchange = (event) =>
        window.settings.saveSettings(checkbox.value,
          isNegative ? !checkbox.checked : checkbox.checked)
    }
  })

  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    let value
    switch (radio.value) {
      case 'true':
        value = true
        break
      case 'false':
        value = false
        break
      default:
        value = radio.value
    }
    radio.checked = settings[radio.name] === value
    if (!eventsAttached) {
      radio.onchange = (event) => {
        window.settings.saveSettings(radio.name, value)
      }
    }
  })

  document.querySelector('#language').value = settings.language
  if (!eventsAttached) {
    document.querySelector('#language').onchange = (event) => {
      window.settings.saveSettings('language', event.target.value)
    }
  }

  document.querySelector('#trayIconStyle').value = settings.trayIconStyle
  if (!eventsAttached) {
    document.querySelector('#trayIconStyle').onchange = (event) => {
      window.settings.saveSettings('trayIconStyle', event.target.value)
    }
  }

  document.querySelectorAll('input[type="range"]').forEach(async range => {
    const divisor = range.dataset.divisor
    const output = range.closest('div').querySelector('output')
    range.value = settings[range.name] / divisor
    const unit = output.dataset.unit
    output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
    document.querySelector('#longBreakEvery').closest('div').querySelector('output')
      .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    if (!eventsAttached) {
      range.onchange = async event => {
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
        window.settings.saveSettings(range.name, range.value * divisor)
      }
      range.oninput = async event => {
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
      }
    }
  })

  document.querySelectorAll('input[type="text"]').forEach(input => {
    input.value = settings[input.name] || ''
    if (!eventsAttached) {
      input.onchange = (event) => {
        window.settings.saveSettings(input.name, input.value)
      }
    }
  })

  // Weather settings: time input
  const offWorkTimeInput = document.querySelector('#weatherOffWorkTime')
  if (offWorkTimeInput) {
    offWorkTimeInput.value = settings.weatherOffWorkTime || '17:30'
    if (!eventsAttached) {
      offWorkTimeInput.onchange = (event) => {
        window.settings.saveSettings('weatherOffWorkTime', event.target.value)
      }
    }
  }

  setupWeatherLocationUi(settings, eventsAttached)

  // Weather alert type checkboxes (nested in weatherAlertTypes object)
  const alertTypeMap = {
    weatherAlertPrecipitation: 'precipitation',
    weatherAlertWind: 'wind',
    weatherAlertExtremeTemp: 'extremeTemp',
    weatherAlertFogDust: 'fogDust'
  }
  const alertTypes = settings.weatherAlertTypes || {}
  for (const [checkboxValue, alertKey] of Object.entries(alertTypeMap)) {
    const el = document.querySelector(`#${checkboxValue}`)
    if (el) {
      el.checked = !!alertTypes[alertKey]
      if (!eventsAttached) {
        el.onchange = () => {
          const current = settings.weatherAlertTypes || {}
          current[alertKey] = el.checked
          window.settings.saveSettings('weatherAlertTypes', current)
        }
      }
    }
  }

  document.querySelector('[name="browseMicrobreakIdeas"]').onclick = async () => {
    const filePath = await window.settings.openIdeasFile('externalMicrobreakIdeasPath')
    if (filePath) {
      document.querySelector('#externalMicrobreakIdeasPath').value = filePath
    }
  }

  document.querySelector('[name="browseBreakIdeas"]').onclick = async () => {
    const filePath = await window.settings.openIdeasFile('externalBreakIdeasPath')
    if (filePath) {
      document.querySelector('#externalBreakIdeasPath').value = filePath
    }
  }

  document.querySelector('[name="editMicrobreakIdeas"]').onclick = async () => {
    const path = document.querySelector('#externalMicrobreakIdeasPath').value
    if (path) {
      await window.settings.openIdeasEditor(path, 'miniBreak')
    } else {
      window.alert(await window.i18next.t('preferences.settings.editNoPath'))
    }
  }

  document.querySelector('[name="editBreakIdeas"]').onclick = async () => {
    const path = document.querySelector('#externalBreakIdeasPath').value
    if (path) {
      await window.settings.openIdeasEditor(path, 'longBreak')
    } else {
      window.alert(await window.i18next.t('preferences.settings.editNoPath'))
    }
  }

  document.querySelectorAll('.sounds img').forEach(preview => {
    if (!eventsAttached) {
      preview.onclick = (event) =>
        window.stretchly.playSound(preview.closest('div').querySelector('input').value)
    }
  })

  setWindowHeight()

  document.querySelectorAll('.enabletype').forEach((element) => {
    element.onclick = async (event) => {
      const enabletypeChecked = document.querySelectorAll('.enabletype:checked')
      if (enabletypeChecked.length === 0) {
        element.checked = true
        window.settings.saveSettings(element.value, element.checked)
        window.alert(await window.i18next.t('preferences.schedule.cantDisableBoth'))
      }
    }
  })

  document.querySelector('[name="restoreDefaults"]').onclick = (event) => {
    window.stretchly.restoreDefaults()
  }

  document.querySelectorAll('.about a').forEach((item) => {
    item.onclick = (event) => {
      event.preventDefault()
      if (event.target.classList.contains('file')) {
        window.electronApi.openPath(event.target.innerHTML)
      } else {
        window.electronApi.openExternal(event.target.href)
      }
    }
  })

  document.querySelector('[name="becomeContributor"]').onclick = () => {
    window.electronApi.openExternal('https://hovancik.net/stretchly/sponsor')
  }

  document.querySelector('[name="alreadyContributor"]').onclick = () => {
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.remove('hidden')
    })
    setWindowHeight()
  }

  document.querySelectorAll('.authenticate a').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault()
      window.stretchly.openContributorAuth(button.dataset.provider)
    }
  })

  document.querySelector('.version').innerHTML = await window.stretchly.getVersion()
  if (!settings.disableAppUpdateFeatures) {
    versionChecker.latest()
      .then(version => {
        document.querySelector('.latestVersion').innerHTML = version.replace('v', '')
      })
      .catch(exception => {
        console.error(exception)
        document.querySelector('.latestVersion').innerHTML = 'N/A'
      })
  }

  function setWindowHeight () {
    const classes = document.querySelector('body').classList
    const scrollHeight = document.querySelector('body').scrollHeight
    const availHeight = window.screen.availHeight
    let height = null
    if (classes.contains('win32')) {
      if (scrollHeight + 40 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 40
      }
    } else {
      if (scrollHeight + 32 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 32
      }
    }
    if (height) {
      window.stretchly.setWindowSize(bounds.width, height)
    }
  }

  function realBreakInterval () {
    const microbreakInterval = document.querySelector('#miniBreakEvery').value * 1
    const breakInterval = document.querySelector('#longBreakEvery').value * 1
    return microbreakInterval * (breakInterval + 1)
  }

  async function setupWeatherLocationUi (settings, eventsAttached) {
    const selectedWrap = document.querySelector('#weatherLocationSelected')
    const selectedName = document.querySelector('#weatherLocationSelectedName')
    const statusEl = document.querySelector('#weatherLocationStatus')
    const resultsEl = document.querySelector('#weatherLocationResults')
    const searchBtn = document.querySelector('#weatherLocationSearch')
    const clearBtn = document.querySelector('#weatherLocationClear')
    const cityInput = document.querySelector('#weatherCity')
    if (!selectedWrap || !selectedName || !statusEl || !resultsEl || !searchBtn || !clearBtn || !cityInput) {
      return
    }

    const refreshSelected = () => {
      const name = settings.weatherLocationName
      const lat = settings.weatherLat
      const lon = settings.weatherLon
      if (name && lat && lon && lat !== 0 && lon !== 0) {
        selectedName.textContent = `${name} (${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)})`
        selectedWrap.classList.remove('hidden')
      } else {
        selectedName.textContent = ''
        selectedWrap.classList.add('hidden')
      }
    }

    const setStatus = async (key) => {
      statusEl.textContent = key ? await window.i18next.t(key) : ''
    }

    const renderResults = (locations) => {
      resultsEl.innerHTML = ''
      if (!locations || locations.length === 0) {
        resultsEl.classList.add('hidden')
        return
      }
      resultsEl.classList.remove('hidden')
      for (const loc of locations) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = loc.displayName
        btn.onclick = () => {
          settings.weatherLocationName = loc.displayName
          settings.weatherLat = loc.lat
          settings.weatherLon = loc.lon
          window.settings.saveSettings('weatherLocationName', loc.displayName)
          window.settings.saveSettings('weatherLat', loc.lat)
          window.settings.saveSettings('weatherLon', loc.lon)
          resultsEl.innerHTML = ''
          resultsEl.classList.add('hidden')
          statusEl.textContent = ''
          refreshSelected()
        }
        resultsEl.appendChild(btn)
      }
    }

    refreshSelected()

    if (!eventsAttached) {
      searchBtn.onclick = async () => {
        const query = cityInput.value.trim()
        const apiKey = document.querySelector('#weatherApiKey')?.value?.trim() || settings.weatherApiKey
        if (!apiKey) {
          await setStatus('preferences.settings.weatherLocationNeedKey')
          return
        }
        if (!query) {
          await setStatus('preferences.settings.weatherLocationNeedQuery')
          return
        }
        await setStatus('preferences.settings.weatherLocationSearching')
        resultsEl.classList.add('hidden')
        try {
          // Ensure API key is saved before search (manager reads from store)
          window.settings.saveSettings('weatherApiKey', apiKey)
          const locations = await window.stretchly.searchWeatherLocations(query)
          if (!locations || locations.length === 0) {
            await setStatus('preferences.settings.weatherLocationNoResults')
            renderResults([])
            return
          }
          statusEl.textContent = ''
          renderResults(locations)
        } catch (e) {
          await setStatus('preferences.settings.weatherLocationError')
          renderResults([])
        }
      }

      clearBtn.onclick = () => {
        settings.weatherLocationName = ''
        settings.weatherLat = null
        settings.weatherLon = null
        window.settings.saveSettings('weatherLocationName', '')
        window.settings.saveSettings('weatherLat', null)
        window.settings.saveSettings('weatherLon', null)
        resultsEl.innerHTML = ''
        resultsEl.classList.add('hidden')
        statusEl.textContent = ''
        refreshSelected()
      }

      cityInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          searchBtn.click()
        }
      })
    }
  }
}
