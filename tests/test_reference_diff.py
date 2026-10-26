import importlib.util
from pathlib import Path
import unittest
p=Path(__file__).resolve().parents[1]/'scripts'/'reference-diff.py'
spec=importlib.util.spec_from_file_location('refdiff',p)
r=importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

class ReferenceDiffTests(unittest.TestCase):
    def test_html_collection_extraction(self):
        d=r.parse_html('<a href="/plans/muse-ai/">Muse AI</a><a href="/plans/chatgpt/">ChatGPT</a>')
        self.assertEqual(r.collections_from_document(d),{'muse-ai','chatgpt'})
    def test_plan_card_price_and_title(self):
        d=r.parse_html('<main><h2>Available plans</h2><article><div><h3><a href="/tool/muse-one/">Muse AI 1B Token 1 Month - 24H Warranty</a></h3></div><p>1 month</p><b>PKR 722</b><a href="/tool/muse-one/">View Details</a></article></main>')
        v=r.extract_plan_cards(d,'muse-ai','/plans/muse-ai/')
        self.assertEqual(len(v),1)
        self.assertEqual(v[0]['reference_price_pkr'],722)
        self.assertEqual(v[0]['name'],'Muse AI 1B Token 1 Month - 24H Warranty')
    def test_preserve_tier_distinction(self):
        self.assertNotEqual(r.key('Meitu VIP+ 7 days'),r.key('Meitu VIP 7 days'))
    def test_4_percent_markup_with_rounding(self):
        self.assertEqual(r.reference_price(722),751)
        self.assertEqual(r.reference_price(72),75)
        self.assertIsNone(r.reference_price(4))
    def test_duplicate_names_and_similar(self):
        samples=[{'name':'Muse AI 1B Token 1 Month - 24H Warranty','reference_price_pkr':722},
                 {'name':'Meitu VIP+ 7 days','reference_price_pkr':200},
                 {'name':'Completely New Brand 1 year Premium 5k credits','reference_price_pkr':2000}]
        result=r.compare(samples,['MUSE AI 1B Token 1 Month 24H Warranty','Meitu VIP 7 days'])
        self.assertEqual(result[0]['decision'],'EXISTS')
        self.assertNotEqual(result[1]['decision'],'EXISTS')
        self.assertEqual(result[2]['decision'],'NEW_CANDIDATE')
    def test_baseline_exists(self):
        self.assertGreaterEqual(len(r.read_baseline()),750)

if __name__=='__main__':unittest.main()

class ReferenceExtractionRegressionTests(unittest.TestCase):
    def test_wrapping_anchor_and_sibling_action_link(self):
        # A title may be inside a whole-card anchor, rather than contain a link.
        markup = '''<main>
          <article><a href="/tool/scribd-edu/"><h3>Scribd Education 1 month</h3></a>
            <span>PKR 1,200</span></article>
          <article><h3>Scribd Premium 1 year</h3><span>PKR 3,450</span>
            <a href="/tool/scribd-year/">View details</a></article>
          </main>'''
        result=r.extract_plan_cards(r.parse_html(markup),'scribd','/plans/scribd/')
        self.assertEqual(len(result),2)
        self.assertEqual({v['name'] for v in result},{'Scribd Education 1 month','Scribd Premium 1 year'})

    def test_pagination_links_discovered_without_assuming_24_page_size(self):
        doc=r.parse_html('''<main><a href="/plans/meitu/page/2/">2</a>
             <a href="/plans/meitu/?page=3">3</a>
             <a href="https://example.com/plans/meitu/page/9/">9</a></main>''')
        self.assertEqual(r.plan_pagination_links(doc,'meitu'),
          ['/plans/meitu/?page=3','/plans/meitu/page/2/'])

    def test_meitu_11_and_scribd_2_can_be_found_across_pages_and_markup(self):
        from unittest.mock import patch
        from tempfile import TemporaryDirectory
        groups=['meitu','scribd']+[f'group-{i}' for i in range(78)]
        main=''.join(f'<a href="/plans/{g}/">{g}</a>' for g in groups)
        def card(title,slug,price=250,wrapped=False):
            if wrapped:
                return f'<article><a href="/tool/{slug}/"><h3>{title}</h3></a><b>PKR {price}</b></article>'
            return f'<article><h3>{title}</h3><b>PKR {price}</b><a href="/tool/{slug}/">Details</a></article>'
        first_meitu='11 plans to explore'+''.join(card(f'Meitu VIP+ {i} days',f'meitu-{i}') for i in range(10))+'<a href="/plans/meitu/page/2/">Next</a>'
        second_meitu=card('Meitu VIP 12 months','meitu-10',1200)
        scribd='2 plans to explore'+card('Scribd 1 month','scribd-1',wrapped=True)+card('Scribd 1 year','scribd-2',wrapped=True)
        def fetch(path):
            if path.startswith('/tools/'):return main
            if path=='/plans/meitu/':return first_meitu
            if path=='/plans/meitu/page/2/':return second_meitu
            if path=='/plans/scribd/':return scribd
            if path.startswith('/plans/group-'):return '1 plan to explore'+card('Other plan',path.strip('/').replace('/','-'))
            raise AssertionError(f'Unexpected URL {path}')
        with TemporaryDirectory() as temp, patch.object(r,'REPORTS',Path(temp)), patch.object(r.time,'sleep',lambda _:None):
            products,found=r.crawl(fetch=fetch)
        self.assertEqual(len(found),80)
        self.assertEqual(len(products),11+2+78)
        self.assertEqual(len([p for p in products if p['brand_group']=='meitu']),11)
        self.assertEqual(len([p for p in products if p['brand_group']=='scribd']),2)

    def test_count_mismatch_still_refuses_import_and_writes_diagnostics(self):
        from unittest.mock import patch
        from tempfile import TemporaryDirectory
        groups=['meitu']+[f'group-{i}' for i in range(79)]
        index=''.join(f'<a href="/plans/{g}/">{g}</a>' for g in groups)
        card='<article><h3><a href="/tool/one/">Plan one</a></h3><b>PKR 250</b></article>'
        def fetch(path):
            if path.startswith('/tools/'):return index
            if path=='/plans/meitu/':return '2 plans to explore'+card
            if path.startswith('/plans/meitu/page/'):raise RuntimeError('404 page does not exist')
            if path.startswith('/plans/group-'):return '1 plan to explore'+card.replace('/one/','/'+path.split('/')[2]+'/')
            raise AssertionError(path)
        with TemporaryDirectory() as temp, patch.object(r,'REPORTS',Path(temp)), patch.object(r.time,'sleep',lambda _:None):
            with self.assertRaisesRegex(RuntimeError,'meitu: expected 2 plans, extracted 1'):
                r.crawl(fetch=fetch)
            diagnostic=__import__('json').loads((Path(temp)/'crawl-diagnostics.json').read_text('utf8'))
        self.assertEqual(diagnostic['groups_with_errors'][0]['group'],'meitu')
        self.assertEqual(diagnostic['groups_with_errors'][0]['extracted'],1)

