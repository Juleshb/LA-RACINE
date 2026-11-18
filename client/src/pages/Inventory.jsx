import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Package, Boxes, AlertTriangle, Wallet, Download, FileSpreadsheet } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCampus } from '../context/CampusContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import FormModeModal from '../components/form/FormModeModal';

const TYPES = ['Consumable', 'Durable equipment', 'Food product', 'Perishable', 'Equipment with serial number'];
const UNITS = ['Piece', 'Box', 'Carton', 'Kg', 'Litre', 'Ream', 'Drum'];
const SERVICES = ['Teaching', 'Administration', 'Maintenance', 'IT', 'Kitchen'];
const PRIORITIES = ['Normal', 'High', 'Urgent'];
const ENTRY_REASONS = ['Purchase', 'Donation', 'Supply', 'Return', 'Other'];
const EXIT_REASONS = ['Distribution to teachers', 'Distribution to services', 'Internal consumption', 'Sale', 'Loss', 'Deterioration', 'Other'];
const ASSET_STATES = ['New', 'Good condition', 'To repair', 'Out of service', 'Retired'];

const STATUS = {
  PENDING: ['Waiting for approval', 'En attente d’approbation'],
  APPROVED: ['Approved', 'Approuvée'],
  REJECTED: ['Rejected', 'Rejetée'],
  CHANGES: ['Changes requested', 'À modifier'],
  PARTIAL: ['Partially served', 'Partiellement servie'],
  SERVED: ['Served', 'Servie'],
  CONFIRMED: ['Receipt confirmed', 'Réception confirmée'],
  RECEIVED: ['Received', 'Reçue'],
  SUBMITTED: ['In transit', 'En transit'],
  Active: ['Active', 'Actif'],
  OUT: ['Out of stock', 'Rupture'],
  LOW: ['Low stock', 'Stock faible'],
};

function text(language, en, fr) {
  return language === 'fr' ? fr : en;
}

function money(value) {
  if (value == null) return '—';
  return `FRW ${Number(value).toLocaleString('fr-FR')}`;
}

function when(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function stockState(article) {
  if (article.qty === 0) return 'OUT';
  if (article.qty <= article.minQty) return 'LOW';
  return article.isActive ? 'Active' : 'Inactive';
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadWorkbook(filename, rows) {
  const [{ default: ExcelJS }, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
  const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock');
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF0C4A6E' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
  sheet.columns.forEach((column) => { column.width = 22; });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export default function Inventory() {
  const { user } = useAuth();
  const { campus } = useCampus();
  const { section = 'overview' } = useParams();
  const { language } = useTranslation();
  const fr = language === 'fr';
  const L = (en, french) => text(language, en, french);
  const [data, setData] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const load = () => {
    setError('');
    api.getInventory()
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, [campus?.id]);
  useEffect(() => { setForm(null); }, [section]);
  useEffect(() => {
    api.getCampuses().then(setCampuses).catch(() => {});
  }, []);

  const run = async (action) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await action();
      setForm(null);
      setNotice(saved?.ref
        ? L(`Saved. Reference ${saved.ref}.`, `Enregistré. Référence ${saved.ref}.`)
        : L('Saved.', 'Enregistré.'));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const articles = data?.articles || [];

  if (!data) {
    return <div className="card p-6 text-sm text-gray-500">{error || L('Loading stock…', 'Chargement du stock…')}</div>;
  }

  const operateSections = new Set(['articles', 'categories', 'stores', 'suppliers', 'purchases', 'entries', 'exits', 'transfers', 'count', 'assets', 'reports', 'history', 'settings']);
  const known = new Set(['overview', 'requests', ...operateSections]);
  const allowed = known.has(section) && (
    data.canOperate
    || section === 'requests'
    || (section === 'overview' && (data.canApprove || data.canOperate || user?.role === 'SECRETARY'))
  );
  if (!allowed) {
    return <Navigate to={`/campus/${campus?.id}/inventory/${data.canApprove ? 'overview' : 'requests'}`} replace />;
  }

  const titles = {
    overview: [L('Stock overview', 'Vue du stock'), L('Quantities, value, and alerts for this campus.', 'Quantités, valeur et alertes de ce campus.')],
    articles: [L('Articles', 'Articles'), L('Catalog and quantities by store.', 'Catalogue et quantités par magasin.')],
    categories: [L('Categories', 'Catégories'), L('How articles are grouped.', 'Classement des articles.')],
    stores: [L('Stores', 'Magasins'), L('Stock rooms on this campus.', 'Magasins de ce campus.')],
    suppliers: [L('Suppliers', 'Fournisseurs'), L('Partners who deliver goods.', 'Partenaires qui livrent.')],
    purchases: [L('Purchases', 'Achats'), L('Orders stay pending until the goods are received.', 'Les commandes restent en attente jusqu’à la réception.')],
    entries: [L('Stock in', 'Entrées'), L('Receipts, donations, and returns.', 'Réceptions, dons et retours.')],
    exits: [L('Stock out', 'Sorties'), L('An exit cannot go below zero.', 'Une sortie ne peut pas passer sous zéro.')],
    requests: [L('Material requests', 'Demandes de matériel'), L('Teacher, head of studies, stock desk, then confirmation.', 'Enseignant, directeur des études, stock, puis confirmation.')],
    transfers: [L('Transfers', 'Transferts'), L('Stock moves when the destination confirms receipt.', 'Le stock bouge à la confirmation de la réception.')],
    count: [L('Physical count', 'Inventaire physique'), L('Compare the shelves with the recorded quantities.', 'Comparer les rayons aux quantités enregistrées.')],
    assets: [L('Equipment', 'Équipements'), L('Durable items and where they are kept.', 'Biens durables et leur emplacement.')],
    reports: [L('Reports', 'Rapports'), L('Current stock, ready to export.', 'État actuel du stock, prêt à exporter.')],
    history: [L('History', 'Historique'), L('Every validated movement stays in the journal.', 'Chaque mouvement validé reste au journal.')],
    settings: [L('Rules', 'Règles'), L('How this campus controls stock.', 'Comment ce campus contrôle le stock.')],
  };
  const [pageTitle, pageDescription] = titles[section] || titles.overview;
  const low = articles.filter((item) => item.qty <= item.minQty);

  return (
    <div>
      <PageHeader title={pageTitle} description={`${pageDescription} ${campus?.name || ''}`} />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}

      {section === 'overview' && (
        <StockOverview L={L} fr={fr} data={data} articles={articles} low={low} language={language} />
      )}

      {section === 'articles' && (
        <>
          <StockBoard
            L={L}
            items={articles}
            search={(item) => `${item.code} ${item.name} ${item.type} ${item.categoryName} ${item.storeName}`}
            placeholder={L('Search by code, name, or category', 'Rechercher par code, désignation, catégorie')}
            filters={[
              { id: 'category', label: L('Category', 'Catégorie'), options: data.categories.map((item) => [item.name, item.name]), match: (item, value) => item.categoryName === value },
              { id: 'store', label: L('Store', 'Magasin'), options: data.stores.map((item) => [item.name, item.name]), match: (item, value) => item.storeName === value },
              { id: 'type', label: L('Type', 'Type'), options: TYPES.map((item) => [item, item]), match: (item, value) => item.type === value },
              { id: 'state', label: L('Status', 'Statut'), options: [['Active', L('In stock', 'Disponible')], ['LOW', L('Low stock', 'Stock faible')], ['OUT', L('Out of stock', 'Rupture')]], match: (item, value) => stockState(item) === value },
            ]}
            action={L('Add an article', 'Ajouter un article')}
            onAction={() => setForm('article')}
            headers={[L('Code', 'Code'), L('Name', 'Désignation'), L('Category', 'Catégorie'), L('Store', 'Magasin'), L('On hand', 'Disponible'), L('Minimum', 'Seuil'), L('Price', 'Prix'), L('Status', 'Statut')]}
            exportName="articles-stock"
            toExport={(rows) => [
              ['Code', 'Name', 'Type', 'Category', 'Store', 'Quantity', 'Unit', 'Minimum', 'Price', 'Status'],
              ...rows.map((item) => [item.code, item.name, item.type, item.categoryName, item.storeName, item.qty, item.unit, item.minQty, item.price, stockState(item)]),
            ]}
            renderRow={(item) => (
              <tr key={item.id}>
                <td className="stock-code">{item.code}</td>
                <td>{item.name}<br /><span className="text-xs text-gray-500">{item.type}</span></td>
                <td>{item.categoryName || '—'}</td>
                <td>{item.storeName}</td>
                <td>{item.qty} {item.unit}</td>
                <td>{item.minQty}</td>
                <td>{money(item.price)}</td>
                <td><Badge value={stockState(item)} fr={fr} /></td>
              </tr>
            )}
          />
          <FormModal open={form === 'article'} title={L('New article', 'Nouvel article')} subtitle={L('The article code is assigned if you leave it empty.', 'Le code article est donné si vous le laissez vide.')} saving={saving} onClose={() => setForm(null)} onSubmit={(body) => run(() => api.createStockArticle(body))}>
            <Field name="name" label={L('Name', 'Désignation')} required />
            <Field name="code" label={L('Code', 'Code article')} />
            <Select name="categoryId" label={L('Category', 'Catégorie')} options={data.categories.map((item) => [item.id, item.name])} />
            <Select name="type" label={L('Type', 'Type')} options={TYPES.map((item) => [item, item])} />
            <Select name="unit" label={L('Unit', 'Unité')} options={UNITS.map((item) => [item, item])} />
            <Field name="price" label={L('Unit price (FRW)', 'Prix unitaire (FRW)')} type="number" />
            <Field name="minQty" label={L('Minimum', 'Seuil minimum')} type="number" />
            <Select name="storeId" label={L('Store', 'Magasin')} required options={data.stores.map((item) => [item.id, `${item.name} · ${item.code}`])} />
            <Select name="supplierId" label={L('Usual supplier', 'Fournisseur habituel')} options={data.suppliers.map((item) => [item.id, item.name])} />
            <Field name="description" label={L('Description', 'Description')} full />
          </FormModal>
        </>
      )}

      {section === 'categories' && (
        <SimpleList
          L={L}
          title={L('New category', 'Nouvelle catégorie')}
          open={form === 'category'}
          onOpen={() => setForm('category')}
          onClose={() => setForm(null)}
          saving={saving}
          button={L('New category', 'Nouvelle catégorie')}
          onSubmit={(body) => run(() => api.createStockCategory(body))}
          exportName="categories-stock"
          headers={[L('Code', 'Code'), L('Category', 'Catégorie'), L('Articles', 'Articles')]}
          rows={data.categories.map((item) => [item.code, item.name, articles.filter((article) => article.categoryId === item.id).length])}
        >
          <Field name="code" label={L('Code', 'Code')} required />
          <Field name="name" label={L('Name', 'Désignation')} required />
        </SimpleList>
      )}

      {section === 'stores' && (
        <SimpleList
          L={L}
          title={L('New store', 'Nouveau magasin')}
          open={form === 'store'}
          onOpen={() => setForm('store')}
          onClose={() => setForm(null)}
          saving={saving}
          button={L('Add a store', 'Ajouter un magasin')}
          onSubmit={(body) => run(() => api.createStockStore(body))}
          exportName="magasins-stock"
          headers={[L('Code', 'Code'), L('Store', 'Magasin'), L('Manager', 'Responsable'), L('Location', 'Localisation'), L('Articles', 'Articles suivis')]}
          rows={data.stores.map((item) => [item.code, item.name, item.manager || '—', item.location || '—', articles.filter((article) => article.storeId === item.id).length])}
        >
          <Field name="code" label={L('Code', 'Code magasin')} />
          <Field name="name" label={L('Name', 'Nom')} required />
          <Field name="manager" label={L('Manager', 'Responsable')} />
          <Field name="location" label={L('Location', 'Localisation')} />
        </SimpleList>
      )}

      {section === 'suppliers' && (
        <SimpleList
          L={L}
          title={L('New supplier', 'Nouveau fournisseur')}
          open={form === 'supplier'}
          onOpen={() => setForm('supplier')}
          onClose={() => setForm(null)}
          saving={saving}
          button={L('New supplier', 'Nouveau fournisseur')}
          onSubmit={(body) => run(() => api.createStockSupplier(body))}
          exportName="fournisseurs-stock"
          headers={[L('Supplier', 'Fournisseur'), L('Contact', 'Contact'), L('Phone', 'Téléphone'), L('Email', 'E-mail'), L('Orders', 'Achats')]}
          rows={data.suppliers.map((item) => [item.name, item.contact || '—', item.phone || '—', item.email || '—', data.purchases.filter((order) => order.supplierId === item.id).length])}
        >
          <Field name="name" label={L('Name', 'Nom du fournisseur')} required />
          <Field name="phone" label={L('Phone', 'Téléphone')} />
          <Field name="email" label={L('Email', 'E-mail')} />
          <Field name="address" label={L('Address', 'Adresse')} />
          <Field name="contact" label={L('Contact person', 'Personne de contact')} />
          <Field name="taxNumber" label={L('Tax number', 'Numéro fiscal')} />
        </SimpleList>
      )}

      {section === 'purchases' && (
        <>
          <StockBoard
            L={L}
            note={L('An order does not change stock. Record a receipt when the goods arrive. The purchase code, such as BC-2026-020, is assigned when you save.', 'La commande ne modifie pas le stock. Enregistrez la réception à l’arrivée. Le code, par exemple BC-2026-020, est donné à l’enregistrement.')}
            items={data.purchases}
            search={(item) => `${item.ref} ${item.supplierName} ${item.articleName}`}
            placeholder={L('Search reference, supplier, or article', 'Rechercher une référence, un fournisseur ou un article')}
            filters={[
              { id: 'status', label: L('Status', 'Statut'), options: [['PENDING', L('Waiting', 'En attente')], ['RECEIVED', L('Received', 'Reçue')]], match: (item, value) => item.status === value },
              { id: 'supplier', label: L('Supplier', 'Fournisseur'), options: data.suppliers.map((item) => [item.id, item.name]), match: (item, value) => item.supplierId === value },
            ]}
            action={L('Purchase order', 'Bon de commande')}
            onAction={() => setForm('purchase')}
            headers={[L('Reference', 'Référence'), L('Supplier', 'Fournisseur'), L('Article', 'Article'), L('Total', 'Montant'), L('Status', 'Statut'), '']}
            exportName="achats-stock"
            toExport={(rows) => [
              ['Reference', 'Supplier', 'Article', 'Quantity', 'Total', 'Status'],
              ...rows.map((item) => [item.ref, item.supplierName, item.articleName, item.qty, item.total, item.status]),
            ]}
            renderRow={(item) => (
              <tr key={item.id}>
                <td className="stock-code">{item.ref}</td>
                <td>{item.supplierName}</td>
                <td>{item.articleName} · {item.qty}</td>
                <td>{money(item.total)}</td>
                <td><Badge value={item.status} fr={fr} /></td>
                <td>
                  {item.status === 'PENDING' && (
                    <button type="button" className="btn-secondary text-xs" onClick={() => run(() => api.receiveStockPurchase(item.id, { articleId: item.articleId, qty: item.qty }))}>
                      {L('Receive', 'Enregistrer réception')}
                    </button>
                  )}
                </td>
              </tr>
            )}
          />
          <FormModal open={form === 'purchase'} title={L('New purchase order', 'Nouveau bon de commande')} subtitle={L('The code BC-year-number is assigned when you save.', 'Le code BC-année-numéro est donné à l’enregistrement.')} saving={saving} onClose={() => setForm(null)} onSubmit={(body) => run(() => api.createStockPurchase(body))}>
            <Select name="supplierId" label={L('Supplier', 'Fournisseur')} required options={data.suppliers.map((item) => [item.id, item.name])} />
            <Select name="articleId" label={L('Article', 'Article')} required options={articles.map((item) => [item.id, item.name])} />
            <Field name="qty" label={L('Quantity', 'Quantité')} type="number" required />
            <Field name="unitPrice" label={L('Unit price (FRW)', 'Prix unitaire (FRW)')} type="number" />
            <Field name="fees" label={L('Extra charges (FRW)', 'Frais supplémentaires (FRW)')} type="number" />
          </FormModal>
        </>
      )}

      {(section === 'entries' || section === 'exits') && (
        <MovementDesk
          kind={section === 'entries' ? 'ENTRY' : 'EXIT'}
          L={L}
          articles={articles}
          stores={data.stores}
          rows={(data.movements || []).filter((item) => item.type === (section === 'entries' ? 'ENTRY' : 'EXIT'))}
          open={form === 'move'}
          onOpen={() => setForm('move')}
          onClose={() => setForm(null)}
          saving={saving}
          onSubmit={(body) => run(() => api.moveStock({ ...body, type: section === 'entries' ? 'ENTRY' : 'EXIT' }))}
        />
      )}

      {section === 'requests' && (
        <RequestDesk
          L={L}
          fr={fr}
          user={user}
          data={data}
          articles={articles}
          open={form === 'request'}
          saving={saving}
          onOpen={() => setForm('request')}
          onClose={() => setForm(null)}
          onCreate={(body) => run(() => api.createStockRequest(body))}
          onDecide={(id, body) => run(() => api.decideStockRequest(id, body))}
          onServe={(id, qty) => run(() => api.serveStockRequest(id, { qty }))}
          onConfirm={(id) => run(() => api.confirmStockRequest(id))}
        />
      )}

      {section === 'transfers' && (
        <TransferDesk
          L={L}
          data={data}
          campuses={campuses}
          campusId={campus?.id}
          open={form === 'transfer'}
          saving={saving}
          onOpen={() => setForm('transfer')}
          onClose={() => setForm(null)}
          onSubmit={(body) => run(() => api.createStockTransfer(body))}
          onReceive={(id) => run(() => api.receiveStockTransfer(id))}
          fr={fr}
        />
      )}

      {section === 'count' && (
        <CountDesk L={L} articles={articles} stores={data.stores} saving={saving} onSubmit={(lines) => run(() => api.submitStockCount(lines))} />
      )}

      {section === 'assets' && (
        <>
          <StockBoard
            L={L}
            items={data.assets}
            search={(item) => `${item.code} ${item.name} ${item.serial} ${item.location} ${item.owner}`}
            placeholder={L('Search code, name, or location', 'Rechercher un code, un nom ou un emplacement')}
            filters={[
              { id: 'state', label: L('Condition', 'État'), options: ASSET_STATES.map((item) => [item, item]), match: (item, value) => item.state === value },
            ]}
            action={L('Add equipment', 'Ajouter un équipement')}
            onAction={() => setForm('asset')}
            headers={[L('Code', 'Code'), L('Name', 'Désignation'), L('Serial', 'N° de série'), L('Location', 'Emplacement'), L('Responsible', 'Responsable'), L('Value', 'Valeur'), L('Condition', 'État')]}
            exportName="equipements-stock"
            toExport={(rows) => [
              ['Code', 'Name', 'Serial', 'Location', 'Owner', 'Price', 'Condition'],
              ...rows.map((item) => [item.code, item.name, item.serial, item.location, item.owner, item.price, item.state]),
            ]}
            renderRow={(item) => (
              <tr key={item.id}>
                <td className="stock-code">{item.code}</td>
                <td>{item.name}</td>
                <td>{item.serial || '—'}</td>
                <td>{item.location || '—'}</td>
                <td>{item.owner || '—'}</td>
                <td>{money(item.price)}</td>
                <td><Badge value={item.state} fr={fr} /></td>
              </tr>
            )}
          />
          <FormModal open={form === 'asset'} title={L('New equipment', 'Nouvel équipement')} saving={saving} onClose={() => setForm(null)} onSubmit={(body) => run(() => api.createStockAsset(body))}>
            <Field name="code" label={L('Code', 'Code')} />
            <Field name="name" label={L('Name', 'Désignation')} required />
            <Field name="serial" label={L('Serial number', 'Numéro de série')} />
            <Field name="location" label={L('Location', 'Emplacement')} />
            <Field name="owner" label={L('Responsible person', 'Responsable')} />
            <Field name="acquiredAt" label={L('Acquired on', 'Date d’acquisition')} type="date" />
            <Field name="price" label={L('Purchase price (FRW)', 'Prix d’acquisition (FRW)')} type="number" />
            <Select name="state" label={L('Condition', 'État')} options={ASSET_STATES.map((item) => [item, item])} />
          </FormModal>
        </>
      )}

      {section === 'reports' && (
        <StockBoard
          L={L}
          items={articles}
          search={(item) => `${item.code} ${item.name} ${item.categoryName} ${item.storeName}`}
          placeholder={L('Search an article', 'Rechercher un article')}
          filters={[
            { id: 'category', label: L('Category', 'Catégorie'), options: data.categories.map((item) => [item.name, item.name]), match: (item, value) => item.categoryName === value },
            { id: 'store', label: L('Store', 'Magasin'), options: data.stores.map((item) => [item.name, item.name]), match: (item, value) => item.storeName === value },
            { id: 'state', label: L('Status', 'Statut'), options: [['Active', L('In stock', 'Disponible')], ['LOW', L('Low stock', 'Stock faible')], ['OUT', L('Out of stock', 'Rupture')]], match: (item, value) => stockState(item) === value },
          ]}
          headers={[L('Article', 'Article'), L('Category', 'Catégorie'), L('Store', 'Magasin'), L('Quantity', 'Quantité'), L('Value', 'Valeur'), L('State', 'État')]}
          exportName="rapport-stock"
          toExport={(rows) => [
            ['Code', 'Name', 'Category', 'Campus', 'Store', 'Quantity', 'Unit price', 'Value', 'Status'],
            ...rows.map((item) => [item.code, item.name, item.categoryName, campus?.name, item.storeName, item.qty, item.price, item.qty * (item.price || 0), stockState(item)]),
          ]}
          renderRow={(item) => (
            <tr key={item.id}>
              <td>{item.name}<br /><span className="text-xs text-gray-500">{item.code}</span></td>
              <td>{item.categoryName || '—'}</td>
              <td>{item.storeName}</td>
              <td>{item.qty} {item.unit}</td>
              <td>{money(item.qty * (item.price || 0))}</td>
              <td><Badge value={stockState(item)} fr={fr} /></td>
            </tr>
          )}
        />
      )}

      {section === 'history' && (
        <StockBoard
          L={L}
          note={L('A validated movement stays in the journal. Correct it with a reverse movement or an inventory adjustment.', 'Un mouvement validé reste au journal. Corrigez-le par un mouvement inverse ou un ajustement d’inventaire.')}
          items={data.movements}
          search={(item) => `${item.ref} ${item.articleName} ${item.actorName} ${item.storeName} ${item.type}`}
          placeholder={L('Search reference, article, or person', 'Rechercher une référence, un article ou une personne')}
          filters={[
            { id: 'type', label: L('Type', 'Type'), options: [['ENTRY', L('Stock in', 'Entrée')], ['EXIT', L('Stock out', 'Sortie')], ['TRANSFER', L('Transfer', 'Transfert')], ['ADJUSTMENT', L('Adjustment', 'Ajustement')]], match: (item, value) => item.type === value },
            { id: 'store', label: L('Store', 'Magasin'), options: data.stores.map((item) => [item.name, item.name]), match: (item, value) => item.storeName === value },
          ]}
          headers={[L('Date', 'Date et heure'), L('Type', 'Type'), L('Article', 'Article'), L('Quantity', 'Quantité'), L('Store', 'Magasin'), L('User', 'Utilisateur'), L('Reference', 'Référence')]}
          exportName="journal-stock"
          toExport={(rows) => [
            ['Date', 'Type', 'Article', 'Quantity', 'Store', 'User', 'Reference'],
            ...rows.map((item) => [when(item.createdAt), item.type, item.articleName, item.qty, item.storeName, item.actorName, item.ref]),
          ]}
          renderRow={(item) => (
            <tr key={item.id}>
              <td>{when(item.createdAt)}</td>
              <td><Badge value={item.type} fr={fr} /></td>
              <td>{item.articleName}</td>
              <td className={item.qty < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{item.qty > 0 ? `+${item.qty}` : item.qty}</td>
              <td>{item.storeName}</td>
              <td>{item.actorName}</td>
              <td className="stock-code">{item.ref || '—'}</td>
            </tr>
          )}
        />
      )}

      {section === 'settings' && (
        <section className="card p-4 space-y-3 text-sm text-gray-700">
          <h2 className="font-bold text-gray-900">{L('How stock is controlled', 'Règles de gestion')}</h2>
          {[
            [L('Negative stock is blocked', 'Bloquer les sorties en stock négatif'), L('Active', 'Actif')],
            [L('The head of studies approves material requests', 'Approbation des demandes par le directeur des études'), L('Active', 'Actif')],
            [L('A transfer between campuses needs confirmation', 'Autorisation requise pour un transfert inter-campus'), L('Active', 'Actif')],
            [L('A purchase is received before it enters stock', 'Réception obligatoire avant entrée d’achat'), L('Active', 'Actif')],
            [L('Movements stay in the journal', 'Journalisation des opérations sensibles'), L('Active', 'Actif')],
          ].map(([rule, state]) => (
            <div key={rule} className="flex justify-between gap-3 border-b border-gray-100 pb-2">
              <span>{rule}</span>
              <Badge value={state === 'Active' || state === 'Actif' ? 'Active' : state} fr={fr} />
            </div>
          ))}
          <p className="text-xs text-gray-500">
            {L(
              'The inventory manager runs this desk. The school manager and school admin have the same access. Teachers request items. The head of studies approves them. Stock changes only when a movement is saved.',
              'Le responsable d’inventaire tient ce bureau. Le gestionnaire et l’administrateur de l’école ont le même accès. Les enseignants demandent. Le directeur des études approuve. Le stock change seulement quand un mouvement est enregistré.',
            )}
          </p>
        </section>
      )}
    </div>
  );
}

const CHART_COLORS = ['#0284c7', '#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];

function StockOverview({ L, fr, data, articles, low, language }) {
  const categories = useMemo(() => {
    const map = new Map();
    articles.forEach((item) => {
      const name = item.categoryName || L('Uncategorized', 'Sans catégorie');
      const row = map.get(name) || { name, qty: 0, value: 0 };
      row.qty += Number(item.qty) || 0;
      row.value += (Number(item.qty) || 0) * (Number(item.price) || 0);
      map.set(name, row);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [articles, L]);

  const stores = useMemo(() => {
    const map = new Map();
    articles.forEach((item) => {
      const name = item.storeName || L('No store', 'Sans magasin');
      const row = map.get(name) || { name, qty: 0 };
      row.qty += Number(item.qty) || 0;
      map.set(name, row);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [articles, L]);

  const months = useMemo(() => {
    const locale = language === 'fr' ? 'fr-FR' : 'en';
    const buckets = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        name: date.toLocaleString(locale, { month: 'short' }),
        entries: 0,
        exits: 0,
      });
    }
    (data.movements || []).forEach((item) => {
      const date = new Date(item.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = buckets.find((row) => row.key === key);
      if (!bucket) return;
      const qty = Math.abs(Number(item.qty) || 0);
      if (item.type === 'ENTRY' || item.type === 'ADJUSTMENT' && Number(item.qty) > 0) bucket.entries += qty;
      if (item.type === 'EXIT' || item.type === 'ADJUSTMENT' && Number(item.qty) < 0) bucket.exits += qty;
    });
    return buckets;
  }, [data.movements, language]);

  const pending = (data.requests || []).filter((item) => item.status === 'PENDING').length;
  const cards = [
    { icon: Package, label: L('Articles', 'Articles'), value: data.summary.articles, hint: L('in the catalog', 'au catalogue') },
    { icon: Boxes, label: L('Units on hand', 'Unités'), value: data.summary.units, hint: L('available now', 'disponibles') },
    { icon: Wallet, label: L('Stock value', 'Valeur'), value: money(data.summary.value), hint: 'FRW' },
    { icon: AlertTriangle, label: L('Alerts', 'Alertes'), value: data.summary.low, hint: L(`${data.summary.out} out · ${pending} waiting`, `${data.summary.out} en rupture · ${pending} en attente`) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">{card.label}</p>
              <card.icon className="w-4 h-4 text-brand-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-4">
          <h2 className="classes-chart-title">{L('Stock by category', 'Stock par catégorie')}</h2>
          <p className="classes-chart-desc">{L('Units currently on the shelves.', 'Unités actuellement en rayon.')}</p>
          {categories.length === 0 ? (
            <p className="classes-chart-empty">{L('Add articles to see this chart.', 'Ajoutez des articles pour voir ce graphique.')}</p>
          ) : (
            <div className="classes-donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categories} dataKey="qty" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} isAnimationActive={false}>
                    {categories.map((row, index) => <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="classes-donut-center">
                <p className="classes-donut-value">{data.summary.units}</p>
                <p className="classes-donut-caption">{L('units', 'unités')}</p>
              </div>
              <div className="classes-chart-legend">
                {categories.slice(0, 6).map((row, index) => (
                  <div key={row.name} className="classes-chart-legend-item">
                    <span className="classes-chart-legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span>{row.name}</span>
                    <strong>{row.qty}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card p-4">
          <h2 className="classes-chart-title">{L('Entries and exits', 'Entrées et sorties')}</h2>
          <p className="classes-chart-desc">{L('Last six months of validated movements.', 'Six derniers mois de mouvements validés.')}</p>
          {months.every((row) => row.entries === 0 && row.exits === 0) ? (
            <p className="classes-chart-empty">{L('Movements will appear here after the first receipt or exit.', 'Les mouvements apparaîtront après la première entrée ou sortie.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="entries" name={L('In', 'Entrées')} fill="#0284c7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="exits" name={L('Out', 'Sorties')} fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-4">
          <h2 className="classes-chart-title">{L('Units by store', 'Unités par magasin')}</h2>
          <p className="classes-chart-desc">{L('Where the stock is kept.', 'Où le stock est rangé.')}</p>
          {stores.length === 0 ? (
            <p className="classes-chart-empty">{L('Create a store, then add articles.', 'Créez un magasin, puis ajoutez des articles.')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stores} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="qty" name={L('Units', 'Unités')} fill="#0369a1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card p-4">
          <h2 className="font-bold text-gray-900">{L('Items to watch', 'Alertes à traiter')}</h2>
          {low.length === 0 && <p className="text-sm text-gray-500 mt-2">{L('No alert for this campus.', 'Aucune alerte pour ce campus.')}</p>}
          {low.slice(0, 8).map((item) => (
            <div key={item.id} className="flex justify-between gap-3 py-2 border-b border-gray-100 text-sm">
              <div>
                <b>{item.name}</b>
                <p className="text-xs text-gray-500">{item.code} · {item.storeName}</p>
              </div>
              <div className="text-right">
                <Badge value={stockState(item)} fr={fr} />
                <p className="text-xs text-gray-500">{item.qty} {item.unit}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Badge({ value, fr }) {
  const pair = STATUS[value];
  const label = pair ? pair[fr ? 1 : 0] : value;
  const tone = /REJECT|OUT|Retired|Out of service/i.test(value) ? 'text-red-700 bg-red-50'
    : /LOW|PENDING|PARTIAL|SUBMITTED|CHANGES|To repair/i.test(value) ? 'text-amber-800 bg-amber-50'
      : 'text-emerald-700 bg-emerald-50';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span>;
}

function StockBoard({
  L, items, search, placeholder, filters = [], action, onAction, note, headers, renderRow, exportName, toExport,
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (q && !String(search(item) || '').toLowerCase().includes(q)) return false;
    return filters.every((filter) => {
      const value = chosen[filter.id];
      return !value || filter.match(item, value);
    });
  }), [items, query, chosen, filters, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const activeFilters = query || Object.values(chosen).some(Boolean);

  const exportRows = () => (toExport ? toExport(filtered) : [headers, ...filtered.map((item) => [search(item)])]);

  return (
    <section className="card p-4 stock-board">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2 flex-1">
          <label className="block min-w-[220px] flex-1">
            <span className="label">{L('Search', 'Recherche')}</span>
            <input className="input" value={query} placeholder={placeholder} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          </label>
          {filters.map((filter) => (
            <label key={filter.id} className="block min-w-[150px]">
              <span className="label">{filter.label}</span>
              <select className="input" value={chosen[filter.id] || ''} onChange={(event) => { setChosen((current) => ({ ...current, [filter.id]: event.target.value })); setPage(1); }}>
                <option value="">{L('All', 'Tous')}</option>
                {filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeFilters && (
            <button type="button" className="btn-secondary text-sm" onClick={() => { setQuery(''); setChosen({}); setPage(1); }}>{L('Clear filters', 'Effacer les filtres')}</button>
          )}
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" disabled={!filtered.length} onClick={() => downloadCsv(exportName || 'stock', exportRows())}>
            <Download className="w-4 h-4" /> {L('CSV', 'CSV')}
          </button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" disabled={!filtered.length || exporting} onClick={async () => {
            setExporting(true);
            try { await downloadWorkbook(exportName || 'stock', exportRows()); } finally { setExporting(false); }
          }}>
            <FileSpreadsheet className="w-4 h-4" /> {L('Excel', 'Excel')}
          </button>
          {action && <button type="button" className="btn-primary text-sm" onClick={onAction}>{action}</button>}
        </div>
      </div>
      {note && <p className="text-xs text-gray-500 mb-3">{note}</p>}
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>{headers.map((header) => <th key={header || 'action'}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {visible.length === 0
              ? <tr><td className="stock-empty" colSpan={headers.length}>{L('No rows match these filters.', 'Aucune ligne pour ces filtres.')}</td></tr>
              : visible.map(renderRow)}
          </tbody>
        </table>
      </div>
      <div className="stock-pager">
        <span>{filtered.length === 0 ? L('0 rows', '0 ligne') : L(`${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`, `${start + 1}–${Math.min(start + pageSize, filtered.length)} sur ${filtered.length}`)}</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            {L('Rows', 'Lignes')}
            <select className="input py-1 w-16" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[8, 15, 30].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary text-xs" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{L('Previous', 'Précédent')}</button>
          <span className="text-xs font-semibold text-gray-600">{safePage} / {pages}</span>
          <button type="button" className="btn-secondary text-xs" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>{L('Next', 'Suivant')}</button>
        </div>
      </div>
    </section>
  );
}

function Field({ name, label, type = 'text', required, full }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      <input className="input" name={name} type={type} required={required} />
    </label>
  );
}

function Select({ name, label, options, required }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" name={name} required={required} defaultValue="">
        <option value="">—</option>
        {options.map(([value, textValue]) => <option key={value} value={value}>{textValue}</option>)}
      </select>
    </label>
  );
}

function FormModal({ open, title, subtitle, saving, onClose, onSubmit, children }) {
  return (
    <FormModeModal
      open={open}
      mode="create"
      size="xl"
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      formId="stock-form"
      submitLabel={title}
      submitting={saving}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()));
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </FormModeModal>
  );
}

function Rows({ headers, children }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div className="stock-table-wrap">
      <table className="stock-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {empty ? <tr><td className="stock-empty" colSpan={headers.length}>—</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
}

function SimpleList({ L, title, open, onOpen, onClose, saving, button, onSubmit, headers, rows, exportName, children }) {
  return (
    <>
      <StockBoard
        L={L}
        items={rows}
        search={(row) => row.join(' ')}
        placeholder={L('Search this list', 'Rechercher dans la liste')}
        action={button}
        onAction={onOpen}
        headers={headers}
        exportName={exportName}
        toExport={(list) => [headers, ...list]}
        renderRow={(row) => (
          <tr key={row.join('|')}>
            {row.map((cell, index) => <td key={`${row[0]}-${index}`} className={index === 0 ? 'stock-code' : ''}>{cell}</td>)}
          </tr>
        )}
      />
      <FormModal open={open} title={title} saving={saving} onClose={onClose} onSubmit={onSubmit}>{children}</FormModal>
    </>
  );
}

function MovementDesk({ kind, L, articles, stores, rows, open, onOpen, onClose, saving, onSubmit }) {
  const reasons = kind === 'ENTRY' ? ENTRY_REASONS : EXIT_REASONS;
  const entry = kind === 'ENTRY';
  return (
    <>
      <StockBoard
        L={L}
        note={entry
          ? L('A code such as IN-2026-001 is assigned when you save.', 'Un code comme IN-2026-001 est donné à l’enregistrement.')
          : L('An exit cannot go below zero. A code such as OUT-2026-019 is assigned when you save.', 'Une sortie ne peut pas passer sous zéro. Un code comme OUT-2026-019 est donné à l’enregistrement.')}
        items={rows}
        search={(item) => `${item.ref} ${item.articleName} ${item.storeName} ${item.actorName} ${item.reason}`}
        placeholder={L('Search reference or article', 'Rechercher une référence ou un article')}
        filters={[
          { id: 'store', label: L('Store', 'Magasin'), options: stores.map((item) => [item.name, item.name]), match: (item, value) => item.storeName === value },
          { id: 'reason', label: L('Reason', 'Motif'), options: reasons.map((item) => [item, item]), match: (item, value) => item.reason === value },
        ]}
        action={entry ? L('Record an entry', 'Enregistrer une entrée') : L('Record an exit', 'Enregistrer une sortie')}
        onAction={onOpen}
        headers={[L('Date', 'Date'), L('Reference', 'Référence'), L('Article', 'Article'), L('Quantity', 'Quantité'), L('Store', 'Magasin'), L('Reason', 'Motif'), L('By', 'Opérateur')]}
        exportName={entry ? 'entrees-stock' : 'sorties-stock'}
        toExport={(list) => [
          ['Date', 'Reference', 'Article', 'Quantity', 'Store', 'Reason', 'User'],
          ...list.map((item) => [when(item.createdAt), item.ref, item.articleName, item.qty, item.storeName, item.reason, item.actorName]),
        ]}
        renderRow={(item) => (
          <tr key={item.id}>
            <td>{when(item.createdAt)}</td>
            <td className="stock-code">{item.ref || '—'}</td>
            <td>{item.articleName}</td>
            <td className={item.qty < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{item.qty > 0 ? `+${item.qty}` : item.qty}</td>
            <td>{item.storeName}</td>
            <td>{item.reason || '—'}</td>
            <td>{item.actorName}</td>
          </tr>
        )}
      />
      <FormModal open={open} title={entry ? L('Stock entry', 'Entrée de stock') : L('Stock exit', 'Sortie de stock')} saving={saving} onClose={onClose} onSubmit={onSubmit}>
        <Select name="articleId" label={L('Article', 'Article')} required options={articles.map((item) => [item.id, `${item.name} (${item.qty})`])} />
        <Field name="qty" label={L('Quantity', 'Quantité')} type="number" required />
        <Select name="reason" label={L('Reason', 'Motif')} options={reasons.map((item) => [item, item])} />
        <Field name="notes" label={L('Notes', 'Observations')} full />
      </FormModal>
    </>
  );
}

function TransferDesk({ L, data, campuses, campusId, open, saving, onOpen, onClose, onSubmit, onReceive, fr }) {
  return (
    <>
      <StockBoard
        L={L}
        note={L('Stock stays where it is until the destination confirms receipt. The transfer code, such as TRF-2026-009, is assigned when you save.', 'Le stock ne change qu’à la confirmation de la réception. Le code, par exemple TRF-2026-009, est donné à l’enregistrement.')}
        items={data.transfers}
        search={(item) => `${item.ref} ${item.articleName} ${item.status}`}
        placeholder={L('Search a transfer', 'Rechercher un transfert')}
        filters={[
          { id: 'status', label: L('Status', 'Statut'), options: [['SUBMITTED', L('In transit', 'En transit')], ['RECEIVED', L('Received', 'Reçue')]], match: (item, value) => item.status === value },
        ]}
        action={L('New transfer', 'Nouveau transfert')}
        onAction={onOpen}
        headers={[L('Reference', 'Référence'), L('Article', 'Article'), L('Quantity', 'Quantité'), L('Status', 'Statut'), '']}
        exportName="transferts-stock"
        toExport={(rows) => [
          ['Reference', 'Article', 'Quantity', 'Status', 'Reason'],
          ...rows.map((item) => [item.ref, item.articleName, item.qty, item.status, item.reason]),
        ]}
        renderRow={(item) => (
          <tr key={item.id}>
            <td className="stock-code">{item.ref}</td>
            <td>{item.articleName}</td>
            <td>{item.qty}</td>
            <td><Badge value={item.status} fr={fr} /></td>
            <td>
              {item.status === 'SUBMITTED' && (
                <button type="button" className="btn-secondary text-xs" onClick={() => onReceive(item.id)}>{L('Confirm receipt', 'Confirmer réception')}</button>
              )}
            </td>
          </tr>
        )}
      />
      <TransferForm L={L} data={data} campuses={campuses} campusId={campusId} open={open} saving={saving} onClose={onClose} onSubmit={onSubmit} />
    </>
  );
}

function TransferForm({ L, data, campuses, campusId, open, saving, onClose, onSubmit }) {
  const [destCampusId, setDestCampusId] = useState(campusId || '');
  const [stores, setStores] = useState(data.stores || []);
  useEffect(() => {
    if (!destCampusId || destCampusId === campusId) {
      setStores(data.stores || []);
      return undefined;
    }
    let cancelled = false;
    api.getStockStores(destCampusId)
      .then((rows) => { if (!cancelled) setStores(rows); })
      .catch(() => { if (!cancelled) setStores([]); });
    return () => { cancelled = true; };
  }, [destCampusId, campusId, data.stores]);
  const otherCampus = destCampusId && destCampusId !== campusId;

  return (
    <FormModeModal
      open={open}
      mode="create"
      size="xl"
      title={L('New transfer', 'Nouveau transfert')}
      subtitle={L('The code TRF-year-number is assigned when you save.', 'Le code TRF-année-numéro est donné à l’enregistrement.')}
      onClose={onClose}
      formId="stock-transfer-form"
      submitLabel={L('New transfer', 'Nouveau transfert')}
      submitting={saving}
      onSubmit={(event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.currentTarget).entries());
        onSubmit({ ...body, destCampusId, authorized: otherCampus ? true : undefined });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select name="sourceStoreId" label={L('Source store', 'Magasin source')} required options={data.stores.map((item) => [item.id, item.name])} />
        <label className="block">
          <span className="label">{L('Destination campus', 'Campus destinataire')}</span>
          <select className="input" name="destCampusId" value={destCampusId} onChange={(event) => setDestCampusId(event.target.value)}>
            {(campuses || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <Select name="destStoreId" label={L('Destination store', 'Magasin destinataire')} required options={stores.map((item) => [item.id, item.name])} />
        <Select name="articleId" label={L('Article', 'Article')} required options={data.articles.map((item) => [item.id, `${item.name} · ${item.storeName}`])} />
        <Field name="qty" label={L('Quantity', 'Quantité')} type="number" required />
        <Field name="reason" label={L('Reason', 'Motif')} />
        {otherCampus && (
          <label className="md:col-span-2 flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="authorized" required className="mt-1" />
            <span>{L('I confirm this transfer between campuses. Stock will not move until the destination receives it.', 'Je confirme ce transfert entre campus. Le stock ne bouge pas avant la réception.')}</span>
          </label>
        )}
      </div>
    </FormModeModal>
  );
}

function RequestDesk({ L, fr, user, data, articles, open, saving, onOpen, onClose, onCreate, onDecide, onServe, onConfirm }) {
  const [dialog, setDialog] = useState(null);
  const statuses = ['PENDING', 'CHANGES', 'APPROVED', 'PARTIAL', 'SERVED', 'CONFIRMED', 'REJECTED'];
  return (
    <>
      <StockBoard
        L={L}
        note={L('Teacher, head of studies, stock desk, then confirmation. The request code, such as DEM-2026-028, is assigned when you save.', 'Enseignant, directeur des études, stock, puis confirmation. Le code, par exemple DEM-2026-028, est donné à l’enregistrement.')}
        items={data.requests}
        search={(item) => `${item.ref} ${item.personName} ${item.articleName} ${item.service}`}
        placeholder={L('Search reference, person, or article', 'Rechercher une référence, une personne ou un article')}
        filters={[
          { id: 'status', label: L('Status', 'Statut'), options: statuses.map((item) => [item, STATUS[item][fr ? 1 : 0]]), match: (item, value) => item.status === value },
          { id: 'priority', label: L('Priority', 'Priorité'), options: PRIORITIES.map((item) => [item, item]), match: (item, value) => item.priority === value },
          { id: 'service', label: L('Service', 'Service'), options: SERVICES.map((item) => [item, item]), match: (item, value) => item.service === value },
        ]}
        action={L('New request', 'Nouvelle demande')}
        onAction={onOpen}
        headers={[L('Reference', 'Référence'), L('Requester', 'Demandeur'), L('Article', 'Article'), L('Asked', 'Demandé'), L('Approved', 'Approuvé'), L('Served', 'Distribué'), L('Priority', 'Priorité'), L('Status', 'Statut'), '']}
        exportName="demandes-stock"
        toExport={(rows) => [
          ['Reference', 'Requester', 'Service', 'Article', 'Asked', 'Approved', 'Served', 'Priority', 'Status', 'Reason'],
          ...rows.map((item) => [item.ref, item.personName, item.service, item.articleName, item.qty, item.approvedQty, item.servedQty, item.priority, item.status, item.reason]),
        ]}
        renderRow={(item) => (
          <tr key={item.id}>
            <td className="stock-code">{item.ref}</td>
            <td>{item.personName}<br /><span className="text-xs text-gray-500">{item.service}</span></td>
            <td>{item.articleName}</td>
            <td>{item.qty}</td>
            <td>{item.approvedQty}</td>
            <td>{item.servedQty}</td>
            <td>{item.priority}</td>
            <td><Badge value={item.status} fr={fr} /></td>
            <td className="space-x-1 whitespace-nowrap">
              {data.canApprove && ['PENDING', 'CHANGES'].includes(item.status) && (
                <>
                  <button type="button" className="btn-secondary text-xs" onClick={() => onDecide(item.id, { decision: 'APPROVED', approvedQty: item.qty })}>{L('Approve', 'Approuver')}</button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => setDialog({ type: 'reject', item })}>{L('Reject', 'Rejeter')}</button>
                </>
              )}
              {data.canOperate && ['APPROVED', 'PARTIAL'].includes(item.status) && (
                <button type="button" className="btn-primary text-xs" onClick={() => setDialog({ type: 'serve', item })}>{L('Distribute', 'Distribuer')}</button>
              )}
              {item.status === 'SERVED' && (item.requesterId === user?.id || data.canOperate) && (
                <button type="button" className="btn-secondary text-xs" onClick={() => onConfirm(item.id)}>{L('Confirm receipt', 'Confirmer réception')}</button>
              )}
            </td>
          </tr>
        )}
      />
      <FormModal open={open} title={L('New material request', 'Nouvelle demande de matériel')} subtitle={L('The code DEM-year-number is assigned when you save.', 'Le code DEM-année-numéro est donné à l’enregistrement.')} saving={saving} onClose={onClose} onSubmit={onCreate}>
        <Select name="service" label={L('Service', 'Fonction / service')} options={SERVICES.map((item) => [item, item])} />
        <Select name="articleId" label={L('Article', 'Article demandé')} options={articles.filter((item) => item.isActive).map((item) => [item.id, item.name])} />
        <Field name="qty" label={L('Quantity', 'Quantité')} type="number" required />
        <Select name="priority" label={L('Priority', 'Priorité')} options={PRIORITIES.map((item) => [item, item])} />
        <Field name="reason" label={L('Reason', 'Motif')} full />
      </FormModal>
      <FormModal
        open={dialog?.type === 'reject'}
        title={L('Reject the request', 'Rejeter la demande')}
        subtitle={dialog?.item?.ref}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={(body) => { const id = dialog.item.id; setDialog(null); onDecide(id, { decision: 'REJECTED', reason: body.reason }); }}
      >
        <Field name="reason" label={L('Reason for rejection', 'Motif du rejet')} required full />
      </FormModal>
      <FormModal
        open={dialog?.type === 'serve'}
        title={L('Distribute', 'Distribuer')}
        subtitle={dialog ? `${dialog.item.articleName} · ${L('remaining', 'reste')} ${dialog.item.approvedQty - dialog.item.servedQty}` : ''}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={(body) => { const id = dialog.item.id; setDialog(null); onServe(id, Number(body.qty)); }}
      >
        <Field name="qty" label={L('Quantity to hand out', 'Quantité à remettre')} type="number" required />
      </FormModal>
    </>
  );
}

function CountDesk({ L, articles, stores, saving, onSubmit }) {
  const [storeId, setStoreId] = useState(stores[0]?.id || '');
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState({});
  const rows = articles.filter((item) => !storeId || item.storeId === storeId);
  return (
    <section className="card p-4">
      <p className="text-sm text-gray-600 mb-3">{L('Count a store, then submit the differences. Stock changes only when you submit.', 'Comptez un magasin, puis soumettez les écarts. Le stock ne change qu’à la soumission.')}</p>
      <select className="input max-w-xs mb-3" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
        {stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <Rows headers={[L('Article', 'Article'), L('Expected', 'Stock théorique'), L('Counted', 'Stock compté'), L('Gap', 'Écart'), L('Note', 'Observation')]}>
        {rows.map((item) => {
          const counted = counts[item.id] == null ? item.qty : Number(counts[item.id]);
          const gap = counted - item.qty;
          return (
            <tr key={item.id}>
              <td className="px-3 py-2">{item.name}</td>
              <td className="px-3 py-2">{item.qty}</td>
              <td className="px-3 py-2">
                <input className="input w-24" type="number" min="0" value={counts[item.id] ?? item.qty} onChange={(event) => setCounts((current) => ({ ...current, [item.id]: event.target.value }))} />
              </td>
              <td className={`px-3 py-2 font-semibold ${gap === 0 ? 'text-emerald-700' : gap > 0 ? 'text-sky-700' : 'text-red-600'}`}>{gap}</td>
              <td className="px-3 py-2">
                <input className="input" placeholder={L('Note', 'Observation')} value={notes[item.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
              </td>
            </tr>
          );
        })}
      </Rows>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => {
          const lines = rows
            .filter((item) => counts[item.id] != null && Number(counts[item.id]) !== item.qty)
            .map((item) => ({ articleId: item.id, counted: Number(counts[item.id]), note: notes[item.id] || '' }));
          if (!lines.length) return;
          if (!window.confirm(L(`${lines.length} difference(s) will update the stock. Continue?`, `${lines.length} écart(s) seront soumis et le stock sera ajusté. Continuer ?`))) return;
          onSubmit(lines);
        }}>{L('Submit the count', 'Soumettre les résultats')}</button>
      </div>
    </section>
  );
}
