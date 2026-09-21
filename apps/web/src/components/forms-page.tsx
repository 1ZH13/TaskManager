'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, StatusBadge } from '../../../../packages/ui/src/index';
import type { Board, FormDefinition, FormField, Project } from '@task-manager/shared';
import type { RepositoryError } from '@task-manager/data';
import { useDemo } from './demo-context';
import { FilterSelect } from './filter-select';

const templates: Array<{ name: string; fields: FormField[] }> = [
  {
    name: 'Solicitud administrativa',
    fields: [
      { id: 'subject', label: 'Asunto', type: 'TEXT', required: true },
      { id: 'details', label: 'Detalles', type: 'TEXTAREA', required: true },
    ],
  },
  {
    name: 'Reporte de incidencia',
    fields: [
      { id: 'title', label: 'Título', type: 'TEXT', required: true },
      { id: 'location', label: 'Ubicación', type: 'TEXT', required: true },
      { id: 'details', label: 'Descripción', type: 'TEXTAREA', required: true },
    ],
  },
  {
    name: 'Solicitud de mantenimiento',
    fields: [
      { id: 'title', label: 'Solicitud', type: 'TEXT', required: true },
      { id: 'date', label: 'Fecha preferida', type: 'DATE', required: false },
    ],
  },
  {
    name: 'Registro de visita',
    fields: [
      { id: 'visitor', label: 'Visitante', type: 'TEXT', required: true },
      { id: 'date', label: 'Fecha', type: 'DATE', required: true },
    ],
  },
  {
    name: 'Encuesta de servicio',
    fields: [
      {
        id: 'rating',
        label: 'Calificación',
        type: 'SELECT',
        required: true,
        options: ['Excelente', 'Buena', 'Regular', 'Deficiente'],
      },
      { id: 'details', label: 'Comentarios', type: 'TEXTAREA', required: false },
    ],
  },
];
function Error({ error }: { error: RepositoryError | null }) {
  return error ? (
    <p className="inline-error" role="alert">
      {error.message}
    </p>
  ) : null;
}
function Field({ field }: { field: FormField }) {
  const common = { name: field.id, required: field.required, 'aria-label': field.label };
  if (field.type === 'TEXTAREA')
    return (
      <label>
        {field.label}
        <textarea {...common} />
      </label>
    );
  if (field.type === 'SELECT') return <SelectField field={field} />;
  if (field.type === 'CHECKBOX')
    return (
      <label>
        <input type="checkbox" {...common} /> {field.label}
      </label>
    );
  return (
    <label>
      {field.label}
      <input type={field.type === 'FILE' ? 'file' : field.type.toLowerCase()} {...common} />
    </label>
  );
}
function SelectField({ field }: { field: FormField }) {
  const [value, setValue] = useState('');
  return (
    <FilterSelect
      label={field.label}
      name={field.id}
      value={value}
      options={[
        { label: 'Seleccionar', value: '' },
        ...(field.options ?? []).map((option) => ({ label: option, value: option })),
      ]}
      onChange={setValue}
    />
  );
}
export function FormsPage({ projectId: forcedProjectId }: { projectId?: string }) {
  const { phId, actor, repository } = useDemo();
  const [forms, setForms] = useState<FormDefinition[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selected, setSelected] = useState(templates[0]!);
  const [status, setStatus] = useState('DRAFT');
  const [destinationProjectId, setDestinationProjectId] = useState('');
  const [destinationBoardId, setDestinationBoardId] = useState('');
  const [fieldType, setFieldType] = useState('TEXT');
  const [fields, setFields] = useState<FormField[]>(templates[0]!.fields);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    void Promise.all([
      repository.listForms({ phId, includeDrafts: actor.role === 'ADMIN' }),
      repository.listProjects({ phId }),
      repository.listBoards({ phId }),
    ])
      .then(([nextForms, nextProjects, nextBoards]) => {
        setForms(
          nextForms.filter((form) => !forcedProjectId || form.projectId === forcedProjectId),
        );
        setProjects(
          nextProjects.filter((project) => !forcedProjectId || project.id === forcedProjectId),
        );
        setBoards(
          nextBoards.filter((board) => !forcedProjectId || board.projectId === forcedProjectId),
        );
      })
      .catch(setError);
  }, [actor.role, forcedProjectId, phId, repository]);
  useEffect(load, [load]);
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const createTask = values.get('createTask') === 'on';
    const destinationProjectId = String(values.get('destinationProjectId') || '') || undefined;
    const destinationBoardId = String(values.get('destinationBoardId') || '') || undefined;
    if (fields.length === 0) {
      setError({ code: 'VALIDATION', message: 'Agrega al menos un campo.', requestId: 'ui' });
      return;
    }
    if (createTask && (!destinationProjectId || !destinationBoardId)) {
      setError({
        code: 'VALIDATION',
        message: 'Elige el proyecto y tablero de destino.',
        requestId: 'ui',
      });
      return;
    }
    void repository
      .createForm({
        phId,
        name: String(values.get('name')),
        description: `Plantilla «${selected.name}».`,
        status: String(values.get('status')) as FormDefinition['status'],
        fields,
        createTask,
        destinationProjectId,
        destinationBoardId,
      })
      .then(() => {
        setNotice('Formulario guardado.');
        load();
      })
      .catch(setError);
  };
  const selectTemplate = (name: string) => {
    const template = templates.find((item) => item.name === name) ?? templates[0]!;
    setSelected(template);
    setFields(template.fields);
  };
  const addField = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const label = String(values.get('fieldLabel')).trim();
    if (!label) return;
    const type = String(values.get('fieldType')) as FormField['type'];
    const options = String(values.get('fieldOptions'))
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setFields((current) => [
      ...current,
      {
        id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${current.length + 1}`,
        label,
        type,
        required: values.get('fieldRequired') === 'on',
        ...(type === 'SELECT' && options.length ? { options } : {}),
      },
    ]);
    event.currentTarget.reset();
  };
  const submit = (form: FormDefinition, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    void repository
      .submitForm({ phId, formId: form.id, values })
      .then((submission) => {
        setNotice(
          submission.createdWorkItemId ? 'Envío recibido y tarea creada.' : 'Envío recibido.',
        );
        event.currentTarget.reset();
      })
      .catch(setError);
  };
  return (
    <section className="workspace-page">
      <p className="eyebrow">Recursos</p>
      <h1>Formularios</h1>
      <p>
        Cinco plantillas iniciales y campos configurables. Los publicados validan datos antes del
        envío.
      </p>
      {actor.role === 'ADMIN' && (
        <>
          <form className="entity-form" onSubmit={create}>
            <FilterSelect
              label="Plantilla"
              value={selected.name}
              options={templates.map((template) => ({
                label: template.name,
                value: template.name,
              }))}
              onChange={selectTemplate}
            />
            <label>
              Nombre
              <input name="name" defaultValue={selected.name} key={selected.name} required />
            </label>
            <FilterSelect
              label="Estado"
              name="status"
              value={status}
              options={[
                { label: 'Borrador', value: 'DRAFT' },
                { label: 'Publicado', value: 'PUBLISHED' },
              ]}
              onChange={setStatus}
            />
            <label>
              <input name="createTask" type="checkbox" /> Crear tarea al recibir
            </label>
            <FilterSelect
              label="Proyecto de destino"
              name="destinationProjectId"
              value={destinationProjectId}
              options={[
                { label: 'Seleccionar proyecto', value: '' },
                ...projects.map((project) => ({ label: project.name, value: project.id })),
              ]}
              onChange={setDestinationProjectId}
            />
            <FilterSelect
              label="Tablero de destino"
              name="destinationBoardId"
              value={destinationBoardId}
              options={[
                { label: 'Seleccionar tablero', value: '' },
                ...boards.map((board) => ({ label: board.name, value: board.id })),
              ]}
              onChange={setDestinationBoardId}
            />
            <fieldset>
              <legend>Vista previa</legend>
              {fields.map((field) => (
                <span key={field.id}>
                  {field.label}
                  {field.required ? ' *' : ''} · {field.type}{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setFields((current) => current.filter((item) => item.id !== field.id))
                    }
                  >
                    Quitar
                  </button>
                  <br />
                </span>
              ))}
            </fieldset>
            <Button>Guardar formulario</Button>
          </form>
          <form className="entity-form" onSubmit={addField}>
            <label>
              Nuevo campo
              <input name="fieldLabel" required />
            </label>
            <FilterSelect
              label="Tipo"
              name="fieldType"
              value={fieldType}
              options={[
                'TEXT',
                'TEXTAREA',
                'EMAIL',
                'NUMBER',
                'DATE',
                'TIME',
                'SELECT',
                'CHECKBOX',
                'FILE',
              ].map((type) => ({ label: type, value: type }))}
              onChange={setFieldType}
            />
            <label>
              Opciones (separadas por coma)
              <input name="fieldOptions" placeholder="Opción 1, Opción 2" />
            </label>
            <label>
              <input name="fieldRequired" type="checkbox" /> Obligatorio
            </label>
            <Button variant="secondary">Añadir campo</Button>
          </form>
        </>
      )}
      <Error error={error} />
      {notice && (
        <p role="status" className="success-notice">
          {notice}
        </p>
      )}
      {!forms ? (
        <div className="tm-skeleton" />
      ) : (
        <div className="entity-list">
          {forms.map((form) => (
            <article className="entity-form" key={form.id}>
              <div>
                <strong>{form.name}</strong>{' '}
                <StatusBadge tone={form.status === 'PUBLISHED' ? 'success' : 'warning'}>
                  {form.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                </StatusBadge>
                <p>{form.description}</p>
              </div>
              {form.status === 'PUBLISHED' && (
                <form onSubmit={(event) => submit(form, event)}>
                  {form.fields.map((field) => (
                    <Field key={field.id} field={field} />
                  ))}
                  <Button>Enviar</Button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
