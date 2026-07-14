const filePath = new URL(window.location.href).searchParams.get('file')
const type = new URL(window.location.href).searchParams.get('type') // 'miniBreak' or 'longBreak'

const tableHeader = document.getElementById('tableHeader')
const ideasBody = document.getElementById('ideasBody')
const errorMsg = document.getElementById('errorMsg')
const addBtn = document.getElementById('addBtn')
const saveBtn = document.getElementById('saveBtn')
const cancelBtn = document.getElementById('cancelBtn')

let items = []

function buildHeader () {
  tableHeader.innerHTML = ''
  if (type === 'miniBreak') {
    tableHeader.innerHTML = '<th data-i18next="ideasEditor.text"></th><th data-i18next="ideasEditor.enabled"></th><th></th>'
  } else {
    tableHeader.innerHTML = '<th data-i18next="ideasEditor.titleColumn"></th><th data-i18next="ideasEditor.text"></th><th data-i18next="ideasEditor.enabled"></th><th></th>'
  }
}

function renderTable () {
  ideasBody.innerHTML = ''
  if (items.length === 0) {
    const row = document.createElement('tr')
    const cell = document.createElement('td')
    cell.colSpan = type === 'miniBreak' ? 3 : 4
    cell.className = 'empty-msg'
    cell.setAttribute('data-i18next', 'ideasEditor.empty')
    row.appendChild(cell)
    ideasBody.appendChild(row)
    return
  }
  items.forEach((item, index) => {
    const row = document.createElement('tr')
    if (type === 'miniBreak') {
      const dataText = typeof item.data === 'string' ? item.data : ''
      row.innerHTML =
        `<td><textarea data-index="${index}" data-field="data">${escapeHtml(dataText)}</textarea></td>` +
        `<td><input type="checkbox" ${item.enabled ? 'checked' : ''} data-index="${index}" data-field="enabled"></td>` +
        `<td><button type="button" class="btn-delete" data-index="${index}" data-i18next="ideasEditor.delete"></button></td>`
    } else {
      const title = Array.isArray(item.data) && item.data[0] ? item.data[0] : ''
      const text = Array.isArray(item.data) && item.data[1] ? item.data[1] : ''
      row.innerHTML =
        `<td><input type="text" value="${escapeHtml(title)}" data-index="${index}" data-field="data-0"></td>` +
        `<td><textarea data-index="${index}" data-field="data-1">${escapeHtml(text)}</textarea></td>` +
        `<td><input type="checkbox" ${item.enabled ? 'checked' : ''} data-index="${index}" data-field="enabled"></td>` +
        `<td><button type="button" class="btn-delete" data-index="${index}" data-i18next="ideasEditor.delete"></button></td>`
    }
    ideasBody.appendChild(row)
  })
}

function escapeHtml (str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML.replace(/"/g, '&quot;')
}

function showError (msg) {
  errorMsg.textContent = msg
  errorMsg.style.display = 'block'
}

function hideError () {
  errorMsg.style.display = 'none'
  errorMsg.textContent = ''
}

function collectData () {
  const result = []
  const rows = ideasBody.querySelectorAll('tr')
  rows.forEach((row) => {
    const checkbox = row.querySelector('input[type="checkbox"]')
    if (!checkbox) return

    const enabled = checkbox.checked

    if (type === 'miniBreak') {
      const data = row.querySelector('[data-field="data"]')
      result.push({ data: data ? data.value : '', enabled })
    } else {
      const data0 = row.querySelector('[data-field="data-0"]')
      const data1 = row.querySelector('[data-field="data-1"]')
      result.push({ data: [data0 ? data0.value : '', data1 ? data1.value : ''], enabled })
    }
  })
  return result
}

function validate (data) {
  for (let i = 0; i < data.length; i++) {
    if (type === 'miniBreak') {
      if (!data[i].data || data[i].data.trim() === '') {
        return `Row ${i + 1}: text must not be empty`
      }
    } else {
      if (!data[i].data[0] || data[i].data[0].trim() === '') {
        return `Row ${i + 1}: title must not be empty`
      }
      if (!data[i].data[1] || data[i].data[1].trim() === '') {
        return `Row ${i + 1}: text must not be empty`
      }
    }
  }
  return null
}

ideasBody.addEventListener('change', (e) => {
  const target = e.target
  const index = parseInt(target.dataset.index)
  if (isNaN(index)) return

  const field = target.dataset.field
  if (field === 'enabled') {
    items[index].enabled = target.checked
  } else if (field === 'data') {
    items[index].data = target.value
  } else if (field === 'data-0') {
    if (!Array.isArray(items[index].data)) items[index].data = ['', '']
    items[index].data[0] = target.value
  } else if (field === 'data-1') {
    if (!Array.isArray(items[index].data)) items[index].data = ['', '']
    items[index].data[1] = target.value
  }
})

ideasBody.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    const index = parseInt(e.target.dataset.index)
    items.splice(index, 1)
    renderTable()
  }
})

addBtn.addEventListener('click', () => {
  hideError()
  if (type === 'miniBreak') {
    items.push({ data: '', enabled: true })
  } else {
    items.push({ data: ['', ''], enabled: true })
  }
  renderTable()
  const lastInput = ideasBody.querySelector('tr:last-child textarea, tr:last-child input[type="text"]')
  if (lastInput) lastInput.focus()
})

saveBtn.addEventListener('click', async () => {
  hideError()
  const data = collectData()
  const error = validate(data)
  if (error) {
    showError(error)
    return
  }
  try {
    const result = await window.ideasEditor.saveIdeasFile(filePath, type, data)
    if (result && result.error) {
      showError(result.error)
    } else {
      window.ideasEditor.closeWindow()
    }
  } catch (err) {
    showError(err.message)
  }
})

cancelBtn.addEventListener('click', () => {
  window.ideasEditor.closeWindow()
})

async function init () {
  buildHeader()
  try {
    const result = await window.ideasEditor.readIdeasFile(filePath, type)
    if (result && result.error) {
      showError(result.error)
      items = []
    } else {
      items = result || []
    }
  } catch (err) {
    showError(err.message)
    items = []
  }
  renderTable()

  // translate static elements
  const elements = document.querySelectorAll('[data-i18next]')
  for (const el of elements) {
    const key = el.getAttribute('data-i18next')
    const translated = await window.i18next.t(key)
    if (el.tagName === 'INPUT' && el.type === 'text') {
      // skip
    } else {
      el.textContent = translated
    }
  }
}

init()
