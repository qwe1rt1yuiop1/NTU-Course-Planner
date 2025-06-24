import { useState } from 'react'

export default function App() {
  // 四年上下學期
  const years = [112, 113, 114, 115, 116, 117, 118] // 大一~大七，學年多加幾年
  const semesterKeys = years.flatMap(y => [`${y}-1`, `${y}-2`])
  const chineseNums = ['一', '二', '三', '四', '五', '六', '七']

  // 對應學期文字，大一上、大一下...大七下
  const semesterLabel = (semesterKey) => {
    const [yearStr, semStr] = semesterKey.split('-')
    const yearNum = parseInt(yearStr, 10)
    const baseYear = 112 // 112年為大一
    const grade = yearNum - baseYear + 1
    if (grade < 1 || grade > 7) return semesterKey
    return `${chineseNums[grade - 1]}${semStr === '1' ? '上' : '下'}`
  }

  const [semester, setSemester] = useState('113-2') // 查詢學期用輸入框改成字串
  const [serial, setSerial] = useState('')
  const [course, setCourse] = useState(null)
  const [alias, setAlias] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [semesterSelect, setSemesterSelect] = useState('113-2') // 加入課表學期

  const [schedules, setSchedules] = useState(() => {
    const init = {}
    semesterKeys.forEach(s => {
      init[s] = []
    })
    return init
  })

  // 新增：紀錄展開的年度（預設都折疊）
  //const [expandedYears, setExpandedYears] = useState(new Set(years))
  const [expandedYears, setExpandedYears] = useState(new Set())

  const toggleYear = (year) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev)
      if (newSet.has(year)) {
        newSet.delete(year)
      } else {
        newSet.add(year)
      }
      return newSet
    })
  }

  // ** 新增屬性功能狀態 **
  const [allAttributes, setAllAttributes] = useState([]) // 所有屬性種類，字串陣列
  const [newAttribute, setNewAttribute] = useState('') // 新增屬性輸入框
  // 查詢區編輯課程屬性（多選）
  const [selectedAttributes, setSelectedAttributes] = useState(new Set())

  const weekdayMap = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }
  const intervals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', 'A', 'B', 'C', 'D']

  const formatSchedule = (schedules) => {
    if (!schedules || schedules.length === 0) return '無資料'
    return schedules.map(s => `${weekdayMap[s.weekday]} ${s.intervals.join(',')}`).join('; ')
  }

  const handleSearch = async () => {
    setLoading(true)
    setCourse(null)
    setAlias('')
    setSelectedAttributes(new Set())
    setError('')

    if (!serial.trim()) {
      setError('請輸入課程流水號或關鍵字')
      setLoading(false)
      return
    }

    const requestBody = {
      query: {
        keyword: serial,
        time: [[], [], [], [], [], []],
        timeStrictMatch: false,
        isFullYear: null,
        excludedKeywords: [],
        enrollMethods: [],
        isEnglishTaught: false,
        isDistanceLearning: false,
        hasChanged: false,
        isAdditionalCourse: false,
        noPrerequisite: false,
        isCanceled: false,
        isIntensive: false,
        semester,
        isPrecise: true,
        department: null,
        suggestedGrade: "",
        departmentCourseType: null,
        isCompulsory: null
      },
      batchSize: 30,
      pageIndex: 0,
      sorting: "correlation"
    }

    try {
      const res = await fetch('https://course.ntu.edu.tw/api/v1/courses/search/dept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

      const data = await res.json()
      if (data.totalCount === 0) {
        setError('查無課程資料')
      } else {
        setCourse(data.courses[0])
        setAlias(data.courses[0].name)
      }
    } catch (e) {
      setError('查詢失敗，請稍後再試')
    }

    setLoading(false)
  }

  const handleAddCourse = () => {
    if (!course) return
    const newCourse = { ...course, alias: alias.trim() || course.name, attributes: Array.from(selectedAttributes) }
    setSchedules(prev => {
      const updated = { ...prev }
      updated[semesterSelect] = [...updated[semesterSelect], newCourse]
      return updated
    })
    const updatedAttributes = allAttributes.map(attr => {
      if (selectedAttributes.has(attr.name)) {
        return { ...attr, earnedCredits: attr.earnedCredits + course.credits };
      }
	  return attr;
	})
    setAllAttributes(updatedAttributes);
    setCourse(null)
    setAlias('')
    setSelectedAttributes(new Set())
  }

const handleRemoveCourse = (index, semesterKey) => {
  // 先取得即將移除的課程（同步處理）
  const removedCourse = schedules[semesterKey][index]
  if (!removedCourse) return

  // 更新課表
  setSchedules(prev => {
    const updated = { ...prev }
    const arr = [...updated[semesterKey]]
    arr.splice(index, 1)
    updated[semesterKey] = arr
    return updated
  })

  // 根據屬性扣學分
  if (Array.isArray(removedCourse.attributes)) {
    setAllAttributes(prevAttrs =>
      prevAttrs.map(attr => {
        if (removedCourse.attributes.includes(attr.name)) {
          return {
            ...attr,
            earnedCredits: Math.max(0, attr.earnedCredits - removedCourse.credits),
          }
        }
        return attr
      })
    )
  }
}

  const totalCredits = (schedule) => schedule.reduce((sum, c) => sum + c.credits, 0)

  const getCellCourses = (schedule, weekday, interval) => {
    const result = []
    for (const c of schedule) {
      for (const s of c.schedules || []) {
        if (s.weekday === weekday && s.intervals.includes(interval)) {
          result.push(c.alias || c.name)
        }
      }
    }
    return result
  }

  const noScheduleCourses = (schedule) => schedule.filter(c => !c.schedules || c.schedules.length === 0)

  const renderScheduleTable = (schedule) => (
    <table style={{
      borderCollapse: 'collapse',
      fontSize: '9px',
      width: '100%',
      tableLayout: 'fixed',
      minWidth: '100px'
    }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ccc', padding: 4, width: 30, textAlign: 'center' }}>節次</th>
          {[1, 2, 3, 4, 5, 6].map(day => (
            <th key={day} style={{
              border: '1px solid #ccc',
              padding: 4,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>{weekdayMap[day]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {intervals.map(interval => (
          <tr key={interval}>
            <td style={{
              border: '1px solid #ccc',
              padding: 4,
              textAlign: 'center',
              verticalAlign: 'top',
              userSelect: 'none'
            }}>{interval}</td>
            {[1, 2, 3, 4, 5, 6].map(day => (
              <td key={day} style={{
                border: '1px solid #ccc',
                verticalAlign: 'top',
                padding: 2,
                overflow: 'hidden'
              }}
                title={getCellCourses(schedule, day, interval).join(', ')}>
                {getCellCourses(schedule, day, interval).map((name, i) => (
                  <div key={i} style={{
                    backgroundColor: '#e0f7fa',
                    color: 'black',
                    marginBottom: 1,
                    padding: '1px 2px',
                    borderRadius: 2,
                    whiteSpace: 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{name}</div>
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

const renderCourseList = (schedule, semesterKey) => (
  <>
    <h3>{semesterLabel(semesterKey)} 課程列表</h3>
    {schedule.length === 0 ? (
      <p>尚未加入任何課程</p>
    ) : (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}
        >
          {schedule.map((c, i) => (
            <div
              key={i}
              style={{
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: 6,
                position: 'relative',
                fontSize: '10px',
              }}
            >
              <button
                onClick={() => handleRemoveCourse(i, semesterKey)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  padding: '2px 4px',
                  fontSize: '10px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                刪除
              </button>

              <div>
                <strong>{c.name}</strong>（{c.alias || c.name}）
              </div>
              <div>
                {c.identifier}&emsp;{c.credits} 學分
              </div>

              <div>
                <div>
                  <strong>教師：</strong>
                  {c.teacher?.name || '無資料'}&emsp;
                  <strong>時間：</strong>
                  {formatSchedule(c.schedules)}
                </div>

                {Array.isArray(c.attributes) && c.attributes.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: '9px' }}>
                    <strong>屬性：</strong>
                    {c.attributes.map((attr, idx) => (
                      <span key={idx} style={{ marginRight: 4 }}>
                        {attr}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 6 }}>
          <strong>總學分：</strong>
          {totalCredits(schedule)}
        </p>
      </>
    )}
  </>
)

  const handleAddAttribute = () => {
    const trimmed = newAttribute.trim()
    //if (trimmed && !allAttributes.includes(trimmed)) {
    if (trimmed  && !allAttributes.some(attr => attr.name === trimmed)) {
      setAllAttributes(prev => [...prev, { name: trimmed, earnedCredits: 0}])
    }
    setNewAttribute('')
  }

  // 選取屬性切換（checkbox）
  const toggleAttributeSelect = (attr) => {
    setSelectedAttributes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(attr)) {
        newSet.delete(attr)
      } else {
        newSet.add(attr)
      }
      return newSet
    })
  }

const handleExport = () => {
  const data = {
    schedules,
    allAttributes,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schedule_backup.json'
  a.click()
  URL.revokeObjectURL(url)
}

const handleImport = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result)
      if (data.schedules && data.allAttributes) {
        setSchedules(data.schedules)
        setAllAttributes(data.allAttributes)
        alert('載入成功')
      } else {
        alert('檔案格式不正確')
      }
    } catch (err) {
      alert('讀取檔案失敗')
    }
  }
  reader.readAsText(file)
}

  return (

    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif',
      gap: '0rem',
      fontSize: '10px',
    }}>
<div style={{ marginBottom: '1rem' }}>
  <button
    onClick={handleExport}
    style={{ marginRight: 10, padding: '4px 8px', fontSize: '10px' }}
  >
    存檔（下載 JSON）
  </button>
  <input
    type="file"
    accept=".json"
    onChange={handleImport}
    style={{ fontSize: '10px' }}
  />
</div>
      {/* 查詢區 */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        minHeight: '180px',
        position: 'relative',
      }}>
      {/* 新增屬性編輯區 */}


<div style={{
  marginBottom: '1rem',
  padding: '8px',
  border: '1px solid #ccc',
  borderRadius: 6,
  fontSize: '10px',
}}>
  <h3 style={{ marginTop: 0, marginBottom: 6 }}>屬性管理</h3>

  {/* 新增屬性輸入 */}
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: 8 }}>
    <input
      type="text"
      placeholder="新增屬性名稱"
      value={newAttribute}
      onChange={e => setNewAttribute(e.target.value)}
      style={{ flexGrow: 1, padding: '4px', fontSize: '10px' }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleAddAttribute()
        }
      }}
    />
    <button
      onClick={handleAddAttribute}
      style={{
        padding: '4px 8px',
        fontSize: '10px',
        backgroundColor: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: 3,
        cursor: 'pointer',
      }}
    >
      新增屬性
    </button>
  </div>

  {/* 屬性列表（直向，每個有刪除按鈕） */}
  {allAttributes.length === 0 ? (
    <p style={{ marginTop: 8, color: '#888' }}>尚無屬性，請新增。</p>
  ) : (
    <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
      {allAttributes.map((attr, i) => (
        <li key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#555555',
          padding: '4px 6px',
          borderRadius: 4,
          marginBottom: 4,
          fontSize: '9px',
        }}>
          <span>{attr.name} ({attr.earnedCredits})</span>
          <button
            onClick={() => {
              // 移除屬性本身
              setAllAttributes(prev => prev.filter(a => a.name !== attr.name))

              // 從所有課程中移除此屬性
              setSchedules(prev => {
                const updated = {}
                for (const [sem, courses] of Object.entries(prev)) {
                  updated[sem] = courses.map(c => ({
                    ...c,
                    attributes: Array.isArray(c.attributes)
                      ? c.attributes.filter(a => a !== attr.name)
                      : [],
                  }))
                }
                return updated
              })
            }}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </li>
      ))}
    </ul>
  )}
</div>

        {/* 查詢表單 */}
        <div style={{
          minWidth: 150,
          maxWidth: 300,
          fontSize: '10px',
        }}>
          <h3 style={{ textAlign: 'center' }}>課程查詢</h3>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="semester">查詢學期（例 113-2）： </label>
            <input
              id="semester"
              type="text"
              value={semester}
              onChange={e => setSemester(e.target.value)}
              placeholder="例如 113-2"
              style={{ padding: 4, width: '100%', fontSize: '10px' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="serial">課程流水號或關鍵字： </label>
            <input
              id="serial"
              type="text"
              value={serial}
              onChange={e => setSerial(e.target.value)}
              placeholder="請輸入流水號或關鍵字"
              style={{ padding: 4, width: '100%', fontSize: '10px' }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              width: '100%',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {loading ? '載入中...' : '查詢'}
          </button>
          {error && <p style={{ color: 'red', marginTop: 8 }}>{error}</p>}
        </div>

        {/* 查詢結果區塊 */}
        {course && (
          <div style={{
            fontSize: '10px',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            width: 'fit-content',
            maxWidth: 400,
          }}>
            <div><strong>{course.name}</strong></div>
            <div>{course.identifier}&emsp;{course.credits} 學分</div>
            <div>
              <strong>教師：</strong>{course.teacher?.name || '無資料'}&emsp;
              <strong>時間：</strong>{formatSchedule(course.schedules)}
            </div>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="alias">別名： </label>
              <input
                id="alias"
                type="text"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                style={{ fontSize: '10px', padding: 2, width: '100%' }}
                placeholder="若填寫，加入後列表會用此名稱"
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="semesterSelect">加入學期：</label>
              <select
                id="semesterSelect"
                value={semesterSelect}
                onChange={e => setSemesterSelect(e.target.value)}
                style={{ fontSize: '10px', padding: 2 }}
              >
                {semesterKeys.map(s => (
                  <option key={s} value={s}>{semesterLabel(s)}</option>
                ))}
              </select>
            </div>

          <fieldset style={{ border: '1px solid #aaa', padding: 6, fontSize: '10px', marginBottom: 8 }}>
            <legend>課程屬性（多選）</legend>
            <div style={{ maxHeight: 80, overflowY: 'auto' }}>
              {allAttributes.length === 0 ? (
                <p style={{ fontSize: '9px', color: '#888' }}>請先在上方新增屬性</p>
              ) : (
                allAttributes.map((attr, i) => (
                  <label key={i} style={{ display: 'block', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={selectedAttributes.has(attr.name)}
                      onChange={() => toggleAttributeSelect(attr.name)}
                      style={{ marginRight: 4 }}
                    />
                    {attr.name}
                  </label>
                ))
              )}
            </div>
          </fieldset>
            <button
              onClick={handleAddCourse}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '6px 8px',
                fontSize: '10px',
                backgroundColor: '#388e3c',
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >加入課表</button>
          </div>
        )}
      </div>

      {/* 多學年度課表區 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {years.map(year => (
          <div key={year} style={{ border: '1px solid #ccc', borderRadius: 6, padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{`${semesterLabel(`${year}-1`).slice(0, 1)}年級`}</h2>
              <button
                onClick={() => toggleYear(year)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '10px',
                  borderRadius: 4,
                  border: '1px solid #666',
                  backgroundColor: expandedYears.has(year) ? '#555555' : '#555555',
                }}
              >
                {expandedYears.has(year) ? '摺疊' : '展開'}
              </button>
            </div>

            {expandedYears.has(year) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr 1.3fr 1fr',
                gap: '1rem',
                alignItems: 'start',
                marginTop: '0.5rem'
              }}>
                {/* 上學期課表 */}
                <div>
                  {renderCourseList(schedules[`${year}-1`], `${year}-1`)}
                </div>
                <div>
                  <h3>{semesterLabel(`${year}-1`)} 時間表</h3>
                  {renderScheduleTable(schedules[`${year}-1`])}
                  {noScheduleCourses(schedules[`${year}-1`]).length > 0 && (
                    <div style={{
                      marginTop: 12,
                      fontSize: '10px',
                      color: 'black',
                      backgroundColor: '#e0f7fa',
                      padding: '4px 6px',
                      borderRadius: 2,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}>
                      <strong>無時間資料的課程：</strong>
                      {noScheduleCourses(schedules[`${year}-1`]).map((c, i) => (
                        <span key={i}>
                          {c.alias || c.name}
                          {i !== noScheduleCourses(schedules[`${year}-1`]).length - 1 ? '，' : ''}
                        </span>
                      ))}
                    </div>
                  )}


                </div>

                {/* 下學期課表 */}
                <div>
                  {renderCourseList(schedules[`${year}-2`], `${year}-2`)}
                </div>
                <div>
                  <h3>{semesterLabel(`${year}-2`)} 時間表</h3>
                  {renderScheduleTable(schedules[`${year}-2`])}
                  {noScheduleCourses(schedules[`${year}-2`]).length > 0 && (
                    <div style={{
                      marginTop: 12,
                      fontSize: '10px',
                      color: 'black',
                      backgroundColor: '#e0f7fa',
                      padding: '4px 6px',
                      borderRadius: 2,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}>
                      <strong>無時間資料的課程：</strong>
                      {noScheduleCourses(schedules[`${year}-2`]).map((c, i) => (
                        <span key={i}>
                          {c.alias || c.name}
                          {i !== noScheduleCourses(schedules[`${year}-2`]).length - 1 ? '，' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
