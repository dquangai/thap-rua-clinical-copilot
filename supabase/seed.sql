insert into public.departments (code, name)
values ('PK53', 'Phòng Khám Chuyên Khoa Phụ Sản')
on conflict (code) do nothing;
