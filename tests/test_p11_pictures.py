"""P11 — image scenes show program-drawn pictures (P.Picture + P.pic sprites) instead of only cube pixels."""
import pytest

PICTURE_MESHES = "(() => { let n = 0; App.root.traverse(o => { if (o.material && o.material.map && o.material.map.isCanvasTexture) n++; }); return n; })()"
IMAGE_SCENES = ["cnn", "diffusion", "ldm", "clip", "yolo-v10", "ocr", "sam2", "sam3", "vision-rag"]


def test_picture_primitive_draws_samples_and_noises(site):
    assert site.ev("typeof P.Picture === 'function' && typeof P.pic === 'object'")
    white = site.ev("(() => { const p = new P.Picture(1, 1, {px: 16, draw: (g, w, h, pic) => pic.plain(g, w, h, '#ffffff')}); return p.lum(2); })()")
    assert len(white) == 4 and all(v > 0.98 for v in white), white
    black = site.ev("(() => { const p = new P.Picture(2, 1, {px: 16, draw: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }}); return [p.py, p.lum(4, 2)]; })()")
    assert black[0] == 8 and len(black[1]) == 8 and all(v < 0.02 for v in black[1]), black
    noised = site.ev("(() => { const p = new P.Picture(1, 1, {px: 16, draw: (g, w, h, pic) => pic.plain(g, w, h, '#000000')}); p.noise(1, 3); const l = p.lum(1)[0]; return l; })()")
    assert 0.2 < noised < 0.8, noised
    calls = ["pic.grass(g,w,h)", "pic.snow(g,w,h)", "pic.room(g,w,h)", "pic.dog(g,w/2,h/2,w*0.7)", "pic.cat(g,w/2,h/2,w*0.7)", "pic.animal(g,'cat',w/2,h/2,w*0.3,h*0.25)",
             "pic.ball(g,w/2,h/2,w*0.3)", "pic.mountain(g,w/2,h/2,w*0.8)", "pic.ramen(g,w/2,h/2,w*0.8)", "pic.car(g,w/2,h/2,w*0.8)", "pic.book(g,w/2,h/2,w*0.8)", "pic.coffee(g,w/2,h/2,w*0.8)",
             "pic.shoe(g,w/2,h/2,w*0.8)", "pic.person(g,w/2,h/2,w*0.8)", "pic.lens(g,w,h,[{x:w*0.3,y:h*0.3,w:w*0.2,h:h*0.2,kind:'scratch'},{x:w*0.6,y:h*0.6,w:w*0.2,h:h*0.2,kind:'spot'},{x:w*0.8,y:h*0.3,w:w*0.2,h:h*0.2,kind:'bubble'}])",
             "pic.page(g,w,h,{kind:'table'})", "pic.page(g,w,h,{kind:'chart',faded:true})", "pic.camo(g,w,h,{cx:w/2,cy:h/2,rx:w*0.3,ry:h*0.2})", "pic.tissue(g,w,h,{cx:w/2,cy:h/2,rx:w*0.2,ry:h*0.25})"]
    for call in calls:
        assert site.ev("c => { const p = new P.Picture(1, 1, {px: 48}); p.draw((g, w, h, pic) => eval(c)); const l = p.lum(1)[0]; return l > 0.01; }", call), call
    site.assert_clean()


@pytest.mark.parametrize("scene_id", IMAGE_SCENES)
def test_image_scene_shows_a_drawn_picture(site, scene_id):
    site.goto(scene_id, settle=500)
    assert site.ev(PICTURE_MESHES) >= 1, f"{scene_id}: no canvas-textured plane in the scene"
    site.assert_clean()


def test_cnn_input_cells_are_sampled_from_the_picture(site):
    site.goto("cnn")
    levels = site.ev("(() => { const s = new Set(); App.root.traverse(o => { if (o.isMesh && o.material && o.material.emissiveIntensity !== undefined && o.geometry && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.46) < 0.01) s.add(o.material.emissiveIntensity.toFixed(2)); }); return s.size; })()")
    assert levels > 3, "the 8×8 input should carry more than an edge's two grey levels"


def test_sam2_mask_cells_are_an_overlay_on_the_picture(site):
    site.goto("sam2", settle=500)
    vis = site.ev("(() => { const ops = []; App.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.44) < 0.01) ops.push(+o.material.opacity.toFixed(2)); }); return [ops.length, ops.filter(v => v > 0.3).length, ops.filter(v => v < 0.1).length]; })()")
    assert vis[0] == 144 and 0 < vis[1] < 60 and vis[2] > 80, vis
    assert int(site.readout("遮罩面積").split()[0]) == vis[1]


def test_ldm_output_picture_is_noise_until_decoded(site):
    site.goto("ldm", settle=500)
    site.set_slider("去噪步數", 4)
    site.ctrl_button("重置").click()
    before = site.ev("(() => { let p = null; App.root.traverse(o => { if (o.userData.picture && o.userData.picture.w > 3) p = o.userData.picture; }); return p.lum(8); })()")
    for _ in range(6):
        site.ctrl_button("單步").click()
    site.page.wait_for_timeout(200)
    after = site.ev("(() => { let p = null; App.root.traverse(o => { if (o.userData.picture && o.userData.picture.w > 3) p = o.userData.picture; }); return p.lum(8); })()")
    spread = lambda a: max(a) - min(a)
    assert spread(after) > spread(before) + 0.15, (spread(before), spread(after))
