/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

/* utilities */

function retrieveTargetTabs(aSerializedTab) {
  var tabs = [aSerializedTab];
  if (aSerializedTab.children &&
      aSerializedTab.states.indexOf('subtree-collapsed') > -1) {
    for (let tab of aSerializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab))
    }
  }
  return tabs;
}

function getTabsBetween(aBegin, aEnd, aAllTabs = []) {
  if (aBegin.id == aEnd.id)
    return [];
  var inRange = false;
  return aAllTabs.filter(aTab => {
    if (aTab.id == aBegin.id || aTab.id == aEnd.id) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

function toggleStateOfDragOverTabs(aParams = {}) {
  if (gDragSelection.firstHoverTarget) {
    // At first, toggle state to reset all existing items in the undetermined selection.
    for (let id of Object.keys(gDragSelection.undeterminedRange)) {
      setSelection(gDragSelection.undeterminedRange[id], !(id in gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }
    gDragSelection.undeterminedRange = {};

    let newUndeterminedRange = aParams.allTargets;
    if (newUndeterminedRange.every(aTab => aTab.id != gDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(gDragSelection.firstHoverTarget);

    let betweenTabs = getTabsBetween(gDragSelection.firstHoverTarget, aParams.target, gDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);
    for (let tab of newUndeterminedRange) {
      if (tab.id in gDragSelection.undeterminedRange)
        continue;
      setSelection(tab, !(tab.id in gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
      gDragSelection.undeterminedRange[tab.id] = tab;
    }
  }
  else {
    for (let tab of aParams.allTargets) {
      gDragSelection.undeterminedRange[tab.id] = tab;
    }
    setSelection(aParams.allTargets, !(aParams.target.id in gSelection.tabs), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: aParams.state
    });
  }
}


/* select tabs by clicking */

var gInSelectionSession = false;

async function onTabItemClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  if (!aMessage.ctrlKey && !aMessage.shiftKey) {
    clearSelection({
      states: ['selected', 'ready-to-close']
    });
    gSelection.targetWindow = null;
    gInSelectionSession = false;
    return;
  }

  let activeTab = (await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  }))[0];

  let tabs = retrieveTargetTabs(aMessage.tab);
  if (aMessage.ctrlKey) {
    // toggle selection of the tab and all collapsed descendants
    if (aMessage.tab.id != activeTab.id &&
        !gInSelectionSession) {
      setSelection(activeTab, true, {
        globalHighlight: false
      });
    }
    setSelection(tabs, aMessage.tab.states.indexOf('selected') < 0, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    return true;
  }
  else if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    clearSelection();
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let betweenTabs = getTabsBetween(activeTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(activeTab);
    setSelection(tabs, true, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    return true;
  }
  return false;
}

async function onNonTabAreaClick(aMessage) {
  if (aMessage.button != 0)
    return;
  clearSelection({
    states: ['selected', 'ready-to-close']
  });
  gSelection.targetWindow = null;
}


/* select tabs by dragging */

var gDragSelection = {
  willCloseSelectedTabs: false,
  allTabsOnDragReady:    [],
  pendingTabs:           null,
  dragStartTarget:       null,
  lastHoverTarget:       null,
  firstHoverTarget:      null,
  undeterminedRange:     {},
  dragEnteredCount:      0
};

async function onTabItemDragReady(aMessage) {
  //console.log('onTabItemDragReady', aMessage);
  gDragSelection.undeterminedRange = {};
  gSelection.targetWindow = aMessage.window;
  gDragSelection.dragEnteredCount = 1;
  gDragSelection.willCloseSelectedTabs = aMessage.startOnClosebox;
  gDragSelection.pendingTabs = null;
  gDragSelection.dragStartTarget = gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget = aMessage.tab;
  gDragSelection.allTabsOnDragReady = await browser.tabs.query({ windowId: aMessage.window });

  clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  var startTabs = retrieveTargetTabs(aMessage.tab);
  setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (let tab of startTabs) {
    gDragSelection.undeterminedRange[tab.id] = tab;
  }
}

async function onTabItemDragStart(aMessage) {
  //console.log('onTabItemDragStart', aMessage);
}

async function onTabItemDragEnter(aMessage) {
  //console.log('onTabItemDragEnter', aMessage, aMessage.tab == gDragSelection.lastHoverTarget);
  gDragSelection.dragEnteredCount++;
  // processAutoScroll(aEvent);

  if (gDragSelection.lastHoverTarget &&
      aMessage.tab.id == gDragSelection.lastHoverTarget.id)
    return;

  var state = gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gDragSelection.pendingTabs) {
    setSelection(gDragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    gDragSelection.pendingTabs = null;
  }
/*
  if (gDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
*/
    let targetTabs = retrieveTargetTabs(aMessage.tab);
    toggleStateOfDragOverTabs({
      target:     aMessage.tab,
      allTargets: targetTabs,
      state:      state
    });
    if (aMessage.tab.id == gDragSelection.dragStartTarget.id &&
        Object.keys(gSelection.tabs).length == targetTabs.length) {
      setSelection(targetTabs, false, {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: state
      });
      for (let tab of targetTabs) {
        gDragSelection.undeterminedRange[tab.id] = tab;
      }
      gDragSelection.pendingTabs = targetTabs;
    }
/*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab.id, { active: true });
  }
*/
  gDragSelection.lastHoverTarget = aMessage.tab;
  if (!gDragSelection.firstHoverTarget)
    gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget;
}

async function onTabItemDragExit(aMessage) {
  gDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+gDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (gDragSelection.dragEnteredCount <= 0) {
    gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget = null;
    gDragSelection.undeterminedRange = {};
  }
}
dragExitAllWithDelay.reserve = () => {
  dragExitAllWithDelay.cancel();
  dragExitAllWithDelay.timeout = setTimeout(() => {
    dragExitAllWithDelay();
  }, 10);
};
dragExitAllWithDelay.cancel = () => {
  if (dragExitAllWithDelay.timeout) {
    clearTimeout(dragExitAllWithDelay.timeout);
    delete dragExitAllWithDelay.timeout;
  }
};

async function onTabItemDragEnd(aMessage) {
  //console.log('onTabItemDragEnd', aMessage);
  if (gDragSelection.willCloseSelectedTabs) {
    let allTabs = gDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    for (let tab of allTabs) {
      if (tab.id in gSelection.tabs)
        await browser.tabs.remove(tab.id);
    }
    clearSelection();
    gSelection.targetWindow = null;
  }
  else if (Object.keys(gSelection.tabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  gDragSelection.dragStartTarget = gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget = null;
  gDragSelection.undeterminedRange = {};
  gDragSelection.willCloseSelectedTabs = false;
  gDragSelection.dragEnteredCount = 0;
  gDragSelection.allTabsOnDragReady = [];
}