(function() {
  const REFRESH_TIME = 5 // seconds
  let sourceSnapshot

  function checkSourceChange() {
    $.get({
      url: '/',
      success: compareSource
    })
  }

  function compareSource(data) {
    if (!sourceSnapshot) {
      console.debug('[AUTO_REFRESH] First run, saving a snapshot of current page...')
    }
    else if (sourceSnapshot !== data) {
      console.debug('[AUTO_REFRESH] Page source changed, reloading')
      window.location.reload()
    }
    else {
      console.debug('[AUTO_REFRESH] No changes...')
    }
    sourceSnapshot = data
  }

  $(function initAutoRefresh() {
    console.log(`[AUTO_REFRESH] Starting auto-refresh: ${REFRESH_TIME} seconds`)
    checkSourceChange()  // Run on startup to get initial state of pages source code
    setInterval(checkSourceChange, (REFRESH_TIME * 1000))
  })
})()