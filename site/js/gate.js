'use strict';

/* ---------- 地图会合入口 ---------- */
(function initMapGate() {
  var gate = document.getElementById('gate');
  var stage = document.getElementById('china-stage');
  var destination = document.getElementById('jiangxi-target');
  var status = document.getElementById('gate-status');
  if (!gate || !stage || !destination || !status) return;

  var target = { x: 0.758, y: 0.719 };
  var complete = false;
  var activePerson = null;
  var people = [
    createPerson('gate-girl', '小小怪学妹', 0.493, 0.791, -0.045),
    createPerson('gate-boy', '大大怪学长', 0.835, 0.77, 0.045)
  ];

  var already = false;
  try { already = sessionStorage.getItem('unlocked') === '1'; } catch (e) {}
  if (already) {
    gate.classList.add('hidden');
    gate.setAttribute('aria-hidden', 'true');
    return;
  }
  document.body.classList.add('gate-open');

  function createPerson(id, label, x, y, snapOffset) {
    return {
      el: document.getElementById(id),
      label: label,
      originX: x,
      originY: y,
      x: x,
      y: y,
      snapOffset: snapOffset,
      pointerId: null,
      grabX: 0,
      grabY: 0,
      arrived: false
    };
  }

  function setPosition(person, x, y) {
    var halfX = person.el.offsetWidth / Math.max(1, stage.clientWidth) / 2;
    var halfY = person.el.offsetHeight / Math.max(1, stage.clientHeight) / 2;
    person.x = Math.max(halfX, Math.min(1 - halfX, x));
    person.y = Math.max(halfY, Math.min(1 - halfY, y));
    person.el.style.left = (person.x * 100).toFixed(3) + '%';
    person.el.style.top = (person.y * 100).toFixed(3) + '%';
  }

  function distanceToTarget(person) {
    var dx = (person.x - target.x) * stage.clientWidth;
    var dy = (person.y - target.y) * stage.clientHeight;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function isInsideJiangxi(person) {
    return distanceToTarget(person) <= destination.offsetWidth * 0.42;
  }

  function updateDestination(person) {
    destination.classList.toggle('is-near', distanceToTarget(person) <= destination.offsetWidth * 1.25);
  }

  function arrive(person) {
    if (person.arrived || complete) return;
    person.arrived = true;
    setPosition(person, target.x + person.snapOffset, target.y);
    person.el.classList.add('is-arrived');
    person.el.setAttribute('aria-label', person.label + '已到江西');
    stage.classList.add('has-arrival');
    destination.classList.remove('is-near');

    var arrivedCount = people.filter(function (item) { return item.arrived; }).length;
    if (arrivedCount === 1) {
      var waiting = people.filter(function (item) { return !item.arrived; })[0];
      status.textContent = person.label + '已到江西，再把' + waiting.label + '带来';
    } else {
      unlock();
    }
  }

  function unlock() {
    if (complete) return;
    complete = true;
    gate.classList.add('is-complete');
    status.textContent = '大大怪学长和小小怪学妹都到江西啦，正在打开我们的宇宙…';
    try { sessionStorage.setItem('unlocked', '1'); } catch (e) {}
    setTimeout(function () {
      gate.classList.add('hidden');
      gate.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gate-open');
    }, 1300);
  }

  function startDrag(person, e) {
    if (complete || person.arrived || !e.isPrimary || (e.button !== undefined && e.button !== 0)) return;
    var stageRect = stage.getBoundingClientRect();
    person.pointerId = e.pointerId;
    person.grabX = e.clientX - (stageRect.left + person.x * stageRect.width);
    person.grabY = e.clientY - (stageRect.top + person.y * stageRect.height);
    activePerson = person;
    person.el.classList.add('is-dragging');
    try { person.el.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function movePerson(person, e) {
    if (person !== activePerson || e.pointerId !== person.pointerId || complete) return;
    var stageRect = stage.getBoundingClientRect();
    setPosition(
      person,
      (e.clientX - stageRect.left - person.grabX) / stageRect.width,
      (e.clientY - stageRect.top - person.grabY) / stageRect.height
    );
    updateDestination(person);
  }

  function endDrag(person, e, shouldCheck) {
    if (person !== activePerson || e.pointerId !== person.pointerId) return;
    person.pointerId = null;
    activePerson = null;
    person.el.classList.remove('is-dragging');
    destination.classList.remove('is-near');
    if (shouldCheck && isInsideJiangxi(person)) arrive(person);
    else if (shouldCheck) status.textContent = '还没到江西，再找找地图上的红色圆圈';
  }

  function handleKeyboard(person, e) {
    if (person.arrived || complete) return;
    var step = 0.025;
    var x = person.x;
    var y = person.y;
    if (e.key === 'ArrowRight') x += step;
    else if (e.key === 'ArrowLeft') x -= step;
    else if (e.key === 'ArrowUp') y -= step;
    else if (e.key === 'ArrowDown') y += step;
    else if (e.key === 'Home') { x = person.originX; y = person.originY; }
    else if (e.key === 'End') { arrive(person); e.preventDefault(); return; }
    else if (e.key === 'Enter' && isInsideJiangxi(person)) { arrive(person); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    setPosition(person, x, y);
    updateDestination(person);
    if (isInsideJiangxi(person)) arrive(person);
  }

  people.forEach(function (person) {
    if (!person.el) return;
    setPosition(person, person.originX, person.originY);
    person.el.addEventListener('pointerdown', function (e) { startDrag(person, e); });
    person.el.addEventListener('pointermove', function (e) { movePerson(person, e); });
    person.el.addEventListener('pointerup', function (e) { endDrag(person, e, true); });
    person.el.addEventListener('pointercancel', function (e) { endDrag(person, e, false); });
    person.el.addEventListener('keydown', function (e) { handleKeyboard(person, e); });
  });

  window.addEventListener('resize', function () {
    people.forEach(function (person) { if (!person.arrived) setPosition(person, person.x, person.y); });
  });
})();
