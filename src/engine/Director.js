import Playwright from './Playwright.js'
import Actor from './Actor.js'
import Player from './Player.js'
import EventBus from './EventBus.js'
import wepy from 'wepy'

export default class Director {

  prepare() {
    this.playwright = this._initPlaywright()
    this.curChapterIdx = this._initChapterIdxFromHistory()
    this.curChapter = this.playwright.getChapter(this.curChapterIdx)
    this.linesOfChapter = this.curChapter ? this.curChapter.lines : undefined
    this.indexOfLines = this._createIndexOfLines(this.linesOfChapter)
    this.curLineIdx = this._initLineIdxFromHistory()
    let roleList = this.playwright.getRoleList()
    this.playerRoleID = this.playwright.getPlayerRoleID()
    this.actors = this._initActors(roleList, this.playerRoleID)
    this.setTitleWithChapterName()
  }

  async action() {
    let that = this
    this.stop = false
    while (!this.stop && this.linesOfChapter && this.curLineIdx < this.linesOfChapter.length) {
      let line = this.linesOfChapter[this.curLineIdx]
      await this._dispatchLine(line).then(() => {
        that.curLineIdx = this._getNextLineIdx()
      }).catch(() => {
        EventBus.publish(EventBus.Events.Restart)
        that.curLineIdx = 0
      })
    }
  }

  async _dispatchLine(line) {
    let actor
    if (line.roleID != undefined) {
      actor = this._getActorByRoleID(line.roleID)
    } else if (line.selections) {
      actor = this._getPlayer()
    }
    if (actor) {
      await actor.prepare(line)
      actor.act(line)
    } else {
      console.log('无效的剧本，未指定演员');
    }
  }

  setTitleWithChapterName() {
    if (this.curChapter) {
      EventBus.publish(EventBus.Events.SetTitle, this.curChapter.name)
    }
  }

  stop() {
    this.stop = true
  }

  saveHistory() {
    wepy.setStorage({
      key: 'key_chapter_index',
      data: this.curChapterIdx
    })
    wepy.setStorage({
      key: 'key_line_index',
      data: this.curLineIdx
    })
  }

  _initPlaywright() {
    return new Playwright()
  }

  _initChapterIdxFromHistory() {
    let chapterIdx = wepy.getStorageSync('key_chapter_index')
    if (typeof(chapterIdx) === 'number') {
      return chapterIdx
    } else {
      return 0
    }
  }

  _initLineIdxFromHistory() {
    let lineIdx = wepy.getStorageSync('key_line_index')
    if (typeof(lineIdx) === 'number') {
      return lineIdx
    } else {
      return 0
    }
  }

  _initActors(roleList, playerRoleID) {
    let actors = []
    if (roleList) {
      for (let idx in roleList) {
        let role = roleList[idx]
        if (playerRoleID == role.id) {
          actors.push(new Player(role, this))
        } else {
          actors.push(new Actor(role, this))
        }
      }
    }
    return actors
  }

  _createIndexOfLines(lines) {
    let indexMap = new Map()
    if (lines) {
      for (let index = 0; index < lines.length; index++) {
        let line = lines[index]
        if (line.id) {
          indexMap.set(line.id, index)
        }
      }
    }
    return indexMap
  }

  _getNextLineIdx(line) {
    let goto
    let curLine = this.linesOfChapter[this.curLineIdx]
    if (curLine.goto != undefined) {
      goto = this.indexOfLines.get(curLine.goto)
      if (goto == undefined) {
        goto = this.curLineIdx + 1
      }
    } else {
      goto = this.curLineIdx + 1
    }
    return goto
  }

  _getRoleByID(roleID) {
    for (let idx in this.roleList) {
      if (this.roleList[idx].id == roleID) {
        return this.roleList[idx]
      }
    }
  }

  _getActorByRoleID(roleID) {
    for (let idx in this.actors) {
      if (this.actors[idx].getID() == roleID) {
        return this.actors[idx]
      }
    }
  }

  _getPlayer() {
    return this._getActorByRoleID(this.playerRoleID)
  }
}
