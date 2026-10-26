-- Прибирає тестові дані, що лишилися в базі після ручної перевірки редактора шаблонів (зріз template-versions),
-- щоб PM перевіряв зріз на чистих даних. Лише дані, схема не змінюється.
-- Лишаються: початкові шаблони «Tenant move-in» і «Maintenance request» (версія 1) і рани зрізу 1.
-- Ризик: незворотне видалення 4 шаблонів (з їхніми секціями, задачами й версіями) та 1 рану з його задачами.
-- id — явним списком: на інших базах цих рядків немає, і міграція нічого не змінює.

-- runs.template_id — on delete restrict: спершу рани цих шаблонів (run_tasks видаляються каскадом).
delete from public.runs
where template_id in (
  '9dd320c7-177d-400a-84fd-6a368f19b954',
  '637fd51e-4fe0-4b1c-aed8-f84d7c8a7b3e',
  '4fbf51e9-1d47-4b54-b37e-e152dd393d35',
  '1c65aa90-2302-4f48-96e4-65ad82288135'
);

-- template_sections, template_tasks, template_versions — on delete cascade.
delete from public.templates
where id in (
  '9dd320c7-177d-400a-84fd-6a368f19b954',
  '637fd51e-4fe0-4b1c-aed8-f84d7c8a7b3e',
  '4fbf51e9-1d47-4b54-b37e-e152dd393d35',
  '1c65aa90-2302-4f48-96e4-65ad82288135'
);
