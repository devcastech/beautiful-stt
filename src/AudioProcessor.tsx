import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CloudUpload, WandSparkles, Music, Sparkles } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { llmModels, models } from './lib/constants';
import { DisplayTranscript } from './components/DisplayTranscript';
import { DisplaySummary } from './components/DisplaySummary';

type ProcessEvent = {
  event: string;
  step: string;
  count?: number;
};
const text = "Música.  Música.  Música.  Música.  Muy buenas tardes a la comunidad de Santa Fe y Antioquia, a los honorables consejales que nos acompañan en el recinto, a nuestros invitados al día de hoy, la comunidad Don Jaime Álvarez que está al día de hoy en el recinto del consejo, un saludo cordial de parte del honorable consejo.  Damos inicio a la sección ordinaria del día viernes 6 de febrero, secretaria por favor, verificación de coro.  Muy buenas tardes para todos, un cordial de saludo para las personas que se encuentran en el recinto, honorables consejales, invitado al día de hoy, el rector de la institución, archivos de San Urbana en Rural y también para las personas que se conectan ante los diferentes medios digitales.  Presidente de Efraín Muñoz Pino.  Presidente.  Vicepresidente, primero, Alba Hernando Rivera García.  Presidente.  Vicepresidente, segundo, doctor Alfonso Gallo Zapata.  Presidente.  Honorables consejales, María Daisy Cartagena Urrego.  Mil compañeros, Rencón, Jaime Molina Zapata, Diego Alejandro Elgin Robledo, Martín Emilio Llepez Valle, Iván Darío Delgado Areiza, Jorge Iván Jaramillo.  Presidente.  Luis Felipe Guite Guita.  Presidente.  Óscar Azerna Montoya.  Omar Andrés Riera Silva.  Hay Cuérense, señor Presidente.  Muchas gracias, secretaria.  Abendú Cuérense, por favor leer el orden del día.  Orden del día, 6 de febrero del 2026, sesiones ordinarias, Primera Reflexión Eina de Santa Fe de Antioquia.  Según la intervención por parte del rector de la institución, Arquídeo Cezana, Urbana y Rural.  El rector, Albert Alexander Ocampo y Guita.  Tercera, proposiciones y varios.  Honorables consejales, se pone en consideración el orden del día.  Sigue en consideración.  Aprueban.  Por favor, aprovechando que es aquí el padre, Albert Alexander Ocampo y Guita, lo invitamos a que nos colabore con la oración para que nos bendiga esta sección.  Bien pueda pase, adelante padre.  Bendiga el día de hoy esta sección que vamos a realizar.  Y nos ayude por medio de su oración a que Dios guíe cada uno de los propósitos y proyectos que tenemos en nuestros municipios.  Bueno, nos colocamos en la presencia del señor.  Quisiera yo traer a la memoria la figura emblemática del gran rey Salomón.  Hijo del gran rey David.  A Salomón le propuso Dios que le pidiera lo que quisiera.  Y Salomón no le pidió ni riquezas ni poder.  Sólo le pidió sabiduría.  Y sabiduría para gobernar al pueblo de Israel.  Y como a Dios le agradó tanto que le pidiera sabiduría y no lo demás, adornó su vida.  Con poder, con riquezas y con todo lo demás.  Yo para este recinto para ustedes queridos honorables consejales pido al señor sabiduría.  Capacidad de discernir entre lo que es bueno y lo que es malo.  Para que en el corazón de ustedes siempre esté el bien común antes que el bien meramente personal.  Que el Dios del cielo los asista, los acompañe y que todo lo que hagan ustedes busque siempre el bienestar  de esta comunidad Santa Fereña que creen ustedes y que de ustedes espera muchísimo.  En las manos de Dios que es Padre nos encomendamos como hijos.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Venga nosotros tu reino, hágase tu voluntad en la tierra como en el cielo.  Dadnos hoy nuestro pan de cada día, perdona nuestras ofensas.  Como también nosotros perdonamos a los que nos ofenden.  No nos dejes caer en la tentación y líbranos del mal amén.  Trono de la sabiduría ruega por nosotros.  En el nombre del Padre y del Hijo y del Espíritu Santo amén.  Venga nosotros tu reino, a todos los que es Padre nos encomendamos como hijos.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Padre nuestro que estás en el cielo, santificado sea tu nombre.  Me damos la bienvenida hoy al rector de la Institución Arquidiócesa  Normana y Rural, al padre Álvaro Alessandro Campullita.  Agradecerle por aceptar esta invitación. Un saludo también cordial  a la persona que la acompaña que hace parte de su equipo de trabajo.  Sabemos que como Consejo Municipal no es una actividad la que vamos a realizar hoy  de control, sino que queremos también tener conocimiento del funcionamiento  de las labores y de su trabajo desde esta institución educativa  que sabemos que es fundamental en nuestro municipio por la educación  de calidad que brinde y que también impacta a gran parte de nuestra comunidad  y queremos saber cómo estos procesos, cómo la administración municipal  ha sido una acompañante de cada uno de estos procesos o cómo nos podemos  seguir articulando a ayudar a mejorar el tema educativo general en nuestro municipio,  cómo nos importa a nosotros como consejales y también a la administración municipal.  Entonces, padre, tiene los micrófonos del consejo para que nos hable de su institución,  de sus progresos, de su balance como tal y también de cómo podemos nosotros  ayudarlo desde este Consejo Municipal. Muchas gracias.  Muy bien, muchas gracias a ustedes por recibirnos en este vetusto, recinto,  siempre nuevo, digo vetusto por la antigüedad y digo nuevo  porque aquí siempre pasa cosas nuevas. Me acompaña la coordinadora Orfa,  quien hasta el año pasado fungía como la rectora de la institución,  conoce mejor el andamiaje interno de la institución, por eso ella está acá  y también en su momento le daremos la palabra para que se pueda dirigir a nosotros.  Lo primero que yo quiero decir es que el Iaúr hace parte de una institución  más amplia que se llama CARED, que es la Corporación Arquidiocesana.  CARED, a su vez, regenta la educación superior con el TECOC,  que es el Tecnológico Católico de Occidente y a su vez regenta el Iaúr,  que es lo que nosotros conocemos como el Colegio Privado.  Entonces, nosotros hemos soñado con un sistema educativo en el que podamos atender  a una grande población en su momento un sueño de un campesino que llegó a ser obispo,  y ya lo tenemos a la mano derecha, el segundo arzobispo de esta Ciudad Madre Monseñor Ignacio Gómez Aristizábal.  En su mente y en su corazón estaba la preocupación por atender a las comunidades campesinas,  a que con ellos pudiéramos impactar con la educación,  que no tuvieran necesidad de salir del territorio, sino que pudiéramos llevar hasta ya la educación,  con ellos saliendo de su ignorancia, entre comillas, pudiéramos hacer con ellos un proceso de alfabetización,  y pudieran desde el campo transformar su propia vida a través del estudio de la educación  y transformar su propia realidad.  Es así como en el año 1998 abrimos por primera vez la puerta de esta institución.  De esta manera comenzamos entonces a brindar una educación que tuvo un impacto muy grande,  no solamente en el Occidente Antioqueño, sino también en el suroeste y en otras latitudes.  El objetivo fundamental era pues impactar con una educación buena a través de los valores cristianos  que ofrece la Iglesia como identidad propia para que de esta manera, en este Occidente,  que es netamente católico, creyente, pudiéramos nosotros pues impactar desde la misma fe esta realidad.  Entre otras cosas, porque en la mente de Monseñor Ignacio estaba ya el pensamiento del Papa Juan Pablo II,  cuando en su encíclica fi de ese ratio se atrevió a decir que la fe y la razón no riñen,  sino que por el contrario la fe y la razón son las dos alas que el hombre tiene para encontrar la verdad.  De tal manera que en esta Antioquia católica y cristiana la Iglesia se ha ocupado y preocupado  por ofrecer pues educación y educación de calidad.  Es así como nace el yaur. En este contexto con el deseo grande repito de descentralizar la educación  y de llegar hasta los lugares más recónditos donde no podía llegar pues sencillamente la oficialidad.  Luego y en los tiempos que corren pues también CARED se ocupa de lo que llamamos nosotros la educación de cobertura,  sobre todo en el Bajo Cauca, todavía en las zonas del Occidente, más de recónditas de la Blanquita,  etcétera, etcétera, comunidades que impactamos nosotros de la Blanquita para dentro a ocho  y a nueve horas comunidades indígenas.  Entonces responde esto a la vocación primera que Monseñor Ignacio soñó para esta institución.  Quisiera yo invitar a Orfa aquí a la palestra para que ella nos cuente un poquito más con detalle  lo que significa esta institución educativa, privada y yaur que como bien lo indica el nombre,  pues es sin ánimo de lucro y que lo que busca es ofrecer educación de calidad.  Buenas tardes. Bueno, hay una cosa que para mí es fundamental en la propuesta educativa que nosotros llevamos en el colegio  y tiene que ver con el tinte, por decirlo de alguna forma, que tiene la propuesta educativa que es desde la religión católica.  Pero desde la religión católica no enfoca solamente a meter a los chicos en un grupo específico de la religión,  sino que es más desde el acompañamiento espiritual y muy desde la formación del ser,  esa formación que es necesaria para que tengamos una niñez, una adolescencia y unos jóvenes que sean parte de una sociedad,  una sociedad que debe ser productiva, que debe ser ejemplar, que se debe envolver en diferentes ámbitos,  unos chicos que estén preparados para enfrentarse a la vida, eso para nosotros es muy indispensable.  Los conocimientos básicos que nos ofrecen las diferentes áreas del conocimiento las vamos a encontrar en cualquier lado.  Ahorita la inteligencia artificial nos ofrece todo, pero la formación del ser no,  esa formación del ser si tiene que ser con un acompañamiento muy especial, muy de cerca,  vivir con ellos el día a día, el poder hablar desde la escuela, pero también desde una institución que es muy importante  y fundamental en la educación de todos y en la familia, como desde la familia son esos primeros pinos  para definir quién soy, definir mi carácter, definir mi futuro y es lo que buscamos con ellos,  que se pueda establecer con ellos un proyecto de vida desde temprana edad para que a futuro tengan los elementos  suficientes para construir lo que ellos quieren ser.  Entonces ahí enmarcamos mucho el acompañamiento, ahorita con la presencia del padre Abel  es una fortaleza muy grande porque se ha profundizado mucho más en la parte espiritual,  el poder entenderlos, el poder escucharlos, el poder hablarles,  el poder de pronto a veces minimizar las diferentes problemáticas con que llegan los niños.  Una vez es ver una carita triste o una carita agresiva y simplemente los juzgamos  y pensamos es el indisciplinado o es el grosero, pero no sabemos la historia que los chicos traen desde su casa,  no sabemos qué es lo que ellos llevan en su corazón y de pronto con el colegio privado hay una equivocación muy grande  y es que se cree que el colegio privado es sinónimo de dinero, entonces los que estudian allá son los hijos de los ricos  y eso es mentira. Tenemos de todo, tenemos los hijos de los funcionarios de la alcaldía,  tenemos hijos de maestros, también tenemos hijos de el ciudadano a pie  que le toca guerriársela todos los días para poder tener sus hijos allá.  Entonces encontramos una población muy diversa y esa diversidad hace que también las problemáticas sean muy diversas  y es donde nosotros necesitamos impactar, donde cada docente, cada directivo docente, la psicorrientadora  siempre estamos prestos a profundizar en sus problemáticas, a saber qué es lo que ellos están necesitando  y muchas veces el solo hecho de que los escuchemos ya es suficiente para ellos calmar sus ansiedades, sus temores, sus miedos  y hay una consigna que siempre la he recitado y creo que debe ser el escenario real de la educación  independiente al yaburo a cualquier institución educativa, es que la institución educativa debe ser el lugar  donde los chicos sean felices, esa época del colegio siempre tiene que marcarnos, pero marcarnos bien  siempre es muy rico cuando uno habla con los compañeros o con otras personas y dicen  yo recuerdo en el colegio cómo pasaba Monterrico, eso es lo que queremos, pero que a la vez nos estemos formando  porque nosotros nos formamos con ellos, nosotros aprendemos todos los días cantidad de cosas y en el yaburo lo que procuramos hacer  por eso es muy importante que nuestro equipo docente también sea un equipo cualificado, un equipo de mucha sensibilidad  de mucho amor por los demás y sobre todo de mucha vocación profesional.  Para que se den cuenta ustedes que las mujeres siempre son más detallistas, este año les cuento aquí a la carrerita  desde el año 2024 hemos soñado con un brindarles a nuestros muchachos espacios más agradables para la educación  el año 2024 empezamos todo un proceso ante la secretaría de educación para que nos permitieran tener una licencia  de funcionamiento en la sede de Carédit de Coq al lado de Fundepase en el llano de Bolívaro, pues este año a primeros  de febrero después de un exhaustivo proceso de verificación, de estar atentos a que cumpliamos con la normativa  nos dijeron es posible que ustedes abran la nueva sede y comiencen a funcionar allá con licencia en mano  la licencia está probada para 382 estudiantes de sexto a once y así comenzamos este año teniendo nuestras nuevas sede  aperturada con los muchachos de sexto a once, esto nos ha permitido a nosotros ampliarnos un poquito más  ofrecerle a nuestros muchachos mayores espacios, mayor comodidad y sobre todo en esa parte del llano de Bolívaro  que ventea tan bueno casi un colegio campestre, ahora tenemos la dicha entonces de estar con nuestros muchachos allá  por supuesto tenemos muchas cosas por mejorar en infraestructura pero que lo básico y lo que es legal  pues está asegurado para que nuestros muchachos reciban una buena educación  lo que decía Orfa ahora lo ratifico yo ahora por ser una institución privada la gente tiene muchos fuicios a priori  y en ocasiones muy errados de lo que eso significa por ser privados y por ser de la diócesis o de la iglesia  muchos en su mente tienen que los del colegio y a Ur sacuden un palo y eso cae en billetes de 100 mil por todos lados  eso no es verdad por el contrario ser privados para nosotros en ocasiones reviste muchas dificultades  porque significa que el tema de proyectos el tema de gestión siempre nos piden a nosotros el impacto para la comunidad  entonces se nos cierran muchas puertas por el hecho de ser privados  me llama mucho la atención que a día de hoy este año tenemos 286 estudiantes de prejardín hasta el grado 11  en la sede de arriba en la sede de Monseñor Benhamín Pardo Londoño tenemos 133 estudiantes  y en la primaria nos quedaron 153 quisimos llamar esta sede de Monseñor Benhamín Pardo Londoño  por lo que este grande hombre significó para esta ciudad para la moral de esta ciudad para la sociedad de Santa Fe de Antioquia  por eso hemos querido rotularla así porque hemos sembrado también en el corazón de nuestros estudiantes  un hombre que puede ser emulado que puede ser imitado pues por todo lo que significó  de tal manera que así grosso modo presentamos nuestra institución  realmente es muy pequeña si lo comparamos con el San Luis Gonzaga y con el Arturo Velázquez  que tienen muchachos por todos lados un equipo docente de 16 hombres y mujeres con vocación de humanidad  y que se ocupan y se preocupan porque estos muchachos estén bien atendidos  hay una particularidad y es que los conocemos nominalmente conocemos sus cuitas, sus historias, sus contextos vitales  y eso nos permite a nosotros intervenir de una manera directa las problemáticas de cada uno de estos muchachos  contamos además nosotros nos hemos distinguido por ser una institución inclusiva, tenemos muchos estudiantes con diagnóstico  y además del acompañamiento de la psicosocial pues tenemos una profesional de apoyo que siempre está acompañando  no sólo el proceso de los muchachos sino también a los padres de familia para que comprendan y puedan intervenir  pues los procesos educativos de los estudiantes mismos  grosso modo pues esta es nuestra institución, esto es lo que nosotros nos apasiona, nos hace vibrar  por ser de la iglesia la gente espera muchísimo de nosotros nos hemos preocupado por mantener un nivel académico bueno  porque la disciplina sea nuestra bandera porque nuestros muchachos salgan organizados en las presentaciones públicas  pero no tanto porque los vean cuanto más porque eso obedece a una formación que es integral  nosotros nos ocupamos de que la integralidad sea, responda mejor a las necesidades de nuestros estudiantes  yo no sé Orfa que qué más le queda  bueno yo quiero comentar algo y que quede claro que no voy a hacer proselitismo pero si quiero agradecer mucho a la alcaldía  y en cabeza de sus funcionarios y del señor alcalde porque hemos gozado de un acompañamiento de varias de sus oficinas  que es bien interesante y es lo que hace que la educación se vuelva muy integral porque no solamente es el desarrollo de un currículo  sino que lo podemos combinar con diferentes disciplinas como es el deporte, la cultura, el tema de la lectura  que es tan indispensable para que podamos tener una mente mucho más abierta y mucho más crítica que es tan necesario en esta época  y con los funcionarios de la alcaldía hemos contado con eso  seguramente no hemos trabajado con todos porque también es muy difícil, nosotros tenemos un plan académico que tenemos que desarrollar  pero siempre hemos encontrado muy buena respuesta en ellos, el INDA era estado muy activo, creo que la institución más activa que tenemos en el colegio  siempre están muy prestos a ayudarnos ahorita, ya tuvimos una primera reunión con ellos  para mirar cómo nos podemos vincular desde nuestro currículo al plan de acción que ellos tienen para poderlo desarrollar con los niños  yo lo tenían muy enfocado a los de primera infancia pero lo ampliamos con su voluntad, lo ampliamos a toda la primaria  entonces es muy interesante el poder ver cómo las diferentes instituciones del municipio nos vinculamos en la formación de los muchachos  y lo hace mucho más efectivo, mucho más productivo y sobre todo mucho más agradable para adquirir los conocimientos  bueno, muchas gracias al padre, a la coordinadora de Liaur, por este informe o información que nos da conocer de la institución  una institución que como todos sabemos tiene un gran reconocimiento en este municipio  y aunque también entendemos que es una entidad privada y que el municipio no puede girar un recurso económico directamente  si sabemos que hay toda una voluntad de este equipo de trabajo como lo decía la coordinadora  para apoyar en cada uno de los procesos donde podamos ser un aporte importante a la educación  que se convierte no a mirar uno al nivel institución si es público o privada sino la base fundamental que es la educación  que favorece a nuestros jóvenes que son el futuro de este municipio y que es bueno saber esta articulación  que han tenido con el municipio que es lo que más nos interesa y como consejales vivimos muy preocupados  de la labor educativa de nuestro municipio y queremos estar al tanto de eso y saber cómo se puede seguir aportando más  tiene la palabra el honorable consejador Álvaro Rivera  gracias señor presidente un saludo especial para la mesa  honorables consejales secretaria al público lo que no me importó los medios al retor Álvaro bienvenido y su coordinadora  hablar yo no la diría se habla lo privado pero los que tenemos ya varios añitos  pero yo quisiera primero que usted nos contara cuánto tiempo lleva como retor en el instituto y a Urmea el favor  realmente llevo cuánto orfa 15 días  yo comencé la rectoría del día ur ahorita en febrero el año pasado fungí como vice rector como vice rector  como coordinador y orfa como rectora  antes estuve también en lo privado porque estuve de rector en el seminario mayor durante seis años  pero bueno no tiene nada que ver una cosa con la otra  definitiva llevo pues es lo que lleva lo que va corrido de este año  retor y consejales los que tenemos ya más del número cinco hacia arriba  pues señor retor sabemos que la educación a nivel nacional era manejada por la iglesia  como tal el estado no tenía ningún manejo en lo que era la educación era manejado por la iglesia  y usted lo dijo muy claro que ese era el nombre que le colocaron de Benjamin Pardo Londoño  si no estoy mal fue retor de la institución y en Salvis Gonzaga en sus tiempos  y en la cual la institución siempre se destacaba cuando lo tenía la iglesia era por ese buen manejo y el nivel de educación que se tenía  entonces creo que los pasos del inicio de la educación a nivel de Colombia se dieron gracias a la iglesia  ahí fue donde se le dio un gran manejo a lo que era la educación  y gracias a Dios a este gran hombre luchador trabajador a juego de la historia  al padre de Benjamin Pardo Londoño la colegó mucho a nuestra ciudad  hay algo señor retor que he venido observando hace días y lo he visto con preocupación y es la salida al medio día de los jóvenes estudiantes  cómo se forma ese taco ahí porque el padre llega en la mototasi, llega en su moto, llegan en el carro  y usted sabe que como tal al frente hay unos negocios que están ocupando un espacio público  qué bueno sería por seguridad que en estas horas  esto negocio como tal no ocupan este espacio para que el padre pueda llegar en su moto, esperar su hijo, en su carro, esperar su hijo  ya después de esa hora pico pues ya los negocios podrían tener esa voluntad de sacar y habilitar ese espacio para ustedes  sería un diálogo que se podría hacer con movilidad, con espacio público, con secretaría de gobierno  para evitar esa coyuntura que se está haciendo ahí al medio día  porque de verdad que el padre no tiene donde estacionar su vehículo  la moto trata de organizarse por el espacio es muy limitado  entonces qué bueno poder llegar a un acuerdo para que ese espacio del frente se ocupara  pero ya después de que los estudiantes salieran por seguridad  lo otro es ya estabilitar a la vía un plan B, la del comando  qué bueno podría tener una salida también por ese lado de pronto para descogestionar un poco la vía principal  mirar a ver de qué forma y ahora vemos que como tenemos de ejército en el antiguo comando  ellos colocaron los policías movibles la cual reduce mucho la movilidad por seguridad  pero también está interrediendo un poco ese tema de entrar y salir a los estudiantes  ese es el tema que yo he observado ahí en ese sector  la otra podría ser como le dije pues en vía de que ya se está habilitado esa calle del comando  es como poder buscar de que los jóvenes puedan salir de una de una forma más fácil  o el padre de familia esperarlos en ese lugar que ya es mucho más fácil de estacionar  ese sería pues como mi inquietud de no repetirlo felicitaciones  lleva muy poco pero yo sé que el trabajo que ustedes tienen en el nivel de educación  es muy bueno porque mirando las pruebas la yagura ha sido la mejor en esas evaluaciones  y lo ha demostrado y sabemos que las instituciones políticas están buscando la forma de llegar  a un nivel con los estudiantes también para poder equiparar y ser mucho mejor a nivel departamental  y por qué no a nacional con ese nivel  entonces felicitarlo y seguir siempre mejorándoles en ese sentido de las pruebas del nivel  municipal y departamental para que sigan siempre siendo los mejores  eso quería felicitarlo a la coordinadora  y yo siempre se habla de lo privado pero como lo dije la educación nació de la iglesia  y viene la iglesia y ustedes vienen dando un paso muy grande a nivel de nuestro municipio  Ritor, muchas gracias a la coordinadora, muchas gracias, gracias señor presidente  bueno quería yo decir que en efecto yo creo que ha sido un foco que hemos identificado también  pero también creo que la ciudadanía ha tenido mucha paciencia porque sabe que por tradición  por tradición a esa hora salen y entran los muchachos  sobre la vía que usted menciona bajando el hospital pues es funcional para unos  para muy pocos diría yo porque la mayoría cogen calle arriba por la calle Mocha  y allá la bifurcación y ya alimentan y coge cada uno para su rumbo  pero realmente nosotros no hemos tenido dificultad a la hora de que los padres lleven los muchachos  y los recojan, hemos solicitado alguna vez al tránsito que nos acompañe  pero conocemos y reconocemos que las unidades de ellos no son siempre las suficientes  para atender a todas las instituciones educativas y que hay unas que son más peligrosas que la nuestra  estoy hablando de las que tienen que ver con la variante, etcétera, etcétera  que requieren por ser vía nacional pues mucho más cuidado  pero sin embargo pues me parece muy interesante la opción de hacer la gestión  de que los negocios del frente nos saquen sus mesas en esas horas pico  Bueno, muchas gracias padre por la intervención a la coordinadora de la institución  por haber estado el día de hoy acompañándonos en el honorable consejo municipal  tiene los micrófonos del consejo para despedirse de los honorables consejales  y de la comunidad que nos acompañe que nos vea a través de las plataformas digitales  Muy bien, pues muchas gracias a ustedes, honorables consejales  a quienes encuentro rostros conocidos por las calles nos hemos cruzado alguna vez  yo además de agradecerles pues también pedimos que oren por nuestra institución  yo creo que hay una cosa tan lamentable hoy en nuestra sociedad  que yo creo que podríamos resumirla en dos cosas  una que hemos perdido la capacidad de trascender  nos hemos quedado en la mera imanencia  no somos capaces de mirar más allá  nos hemos quedado con lo meramente biológico, con lo meramente material  con lo meramente estrinseco  pero es necesario ir a lo profundo, a lo intrínseco, a lo esencial  para descubrir que realmente hay un ser superior  y que nosotros hay una dimensión ínsita que clama y tiende hacia allá  y segundo pues que los hombres y las mujeres de hoy vivimos como si no nos fuéramos a morir  tan temporales, con la mirada tan recortada y tan acá adelante  que se nos ha olvidado pues esta cosa tan bonita que tenemos que vivir  entonces agradecerles primero, segundo que oren por nuestros muchachos  por nuestra institución, por las instituciones, por nuestros jóvenes, por nuestros niños  para que podamos hacer de ellos hombres y mujeres de sociedad, hombres y mujeres de bien  así que Dios les pague por abrir no solamente la entraña de esta casa  sino también el oído de ustedes para escuchar lo referente a nuestra institución  muchas gracias  bueno también quiero agradecerles por el espacio que nos brindaron acá  así como les decía ahorita a los niños les interesa mucho y es muy productivo  cuando los escuchamos para nosotros también  es muy importante siempre cuando alguien nos está escuchando y sobre todo  que ese momento genere algún producto, beneficio y en este caso  para los estudiantes que tenemos nosotros que aunque se llaman privados  son de la ciudadanía de Santa Fe de Antioquia  yo creo que este escenario y yo sí me quiero aprovechar de eso  no sé con quién lo haré luego pero me parece que es un escenario muy interesante  y más ahorita este año que estamos con todo el tema de campañas políticas  precisamente como parte de la formación de la formación política de nuestros estudiantes  el año pasado creo que estuvieron un grupo de estudiantes estuvo con ustedes  y yo quisiera fortalecer mucho eso  en algún momento hicimos un programa muy bonito en un municipio que se llamaban los concejalitos  y eran nuestros estudiantes representándolos a ustedes  con ustedes dando los debates frente a diferentes temáticas que se presentan en el municipio  y eso les permite a ellos o les obliga a prepararse para ese momento  y les genera una conciencia muy crítica el poder conocer de muy cerca  cómo es la problemática del municipio, cómo se mueve todo ese engranaje político que vivimos  y que ellos puedan aportar, puedan opinar  yo sí quisiera que nos abrieran el espacio para eso, para estar acá con los chicos  ya lo hablaré, no sé pronto con el presidente  y yo espero que sí, podamos estar aquí con ellos  muchísimas gracias  muchas gracias a ustedes por estar aquí  claro que sí, estamos puestos y dispuestos a abrir estos espacios  que son también de educación y que obviamente reconocemos  que estas, estos niños y jóvenes que hoy están en las instituciones  son los relevos generacionales de nosotros y los que aspiramos a que ocupen estos cargos a futuro  y muy importante que desde ya le cojan el aprecio, el amor a lo político, a lo público  y a lo que es trabajar por la comunidad  claro que sí, secretaria por favor, continuar con el orden del día  tercero, proposiciones y varios  bien, por el día de hoy damos por terminada la sección  mañana citamos para las 7 de la mañana  invitado a la institución educativa Arturo Velasquez Ortiz  por favor secretaria, llama la lista  presidente de Fraín Muñoz Pino  presidente  presidente primero Alvaro Hernando Rivera García  presidente  segundo doctor Alfonso Gallo Zapata  honorables consejales Maria daís y Cartagena Urego  presidente  Milton Paneso Rincón  presidente  Jaime Molina Zapata  Diego Alejandro Alguien Roledo  presidente  Martín Emilio Llepez Valle  presidente  Iván Darío del Gavareza  Jorge Iván Jaramillo  Luis Felipe Guita  presidente  Óscara Serna Montoya  y Omar André Riera Silva  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  www.mooji.org  que se ve bien."
export const AudioProcessor = () => {
  const [selectedFilePath, setSelectedFileFilePath] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>(text);
  const [processStep, setProcessStep] = useState<ProcessEvent | null>(null);
  const [model, setModel] = useState<string>(models[1].name);
  const [resourcesUsed, setResourcesUsed] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [llmModel, setLlmModel] = useState<string>(llmModels[0].name);
  const [outputMode, setOutputMode] = useState<'summary' | 'acta'>('summary');

  useEffect(() => {
    const unlisten = listen<ProcessEvent>('process', (event) => {
      console.log(event);
      if (['process', 'summary_progress'].includes(event.payload.event)) {
        setProcessStep({
          event: event.payload.event,
          step: event.payload.step,
          ...(event.payload?.count != null && { count: event.payload.count }),
        });
      }
      if (event.payload.event === 'transcript_segment') {
        setResult((prev) => prev + event.payload.step);
      }

      if (event.payload.event === 'summary_segment') {
        setSummary((prev) => prev + event.payload.step);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    async function detectGPU() {
      const response = await invoke('detect_gpu', {
        filePath: selectedFilePath,
        whisperModel: model,
      });
      setResourcesUsed(response as string);
    }
    detectGPU();
  }, []);

  const processAudioFile = async () => {
    setIsProcessing(true);
    setSummary('');
    setResult('');
    setProcessStep(null);
    const response = await invoke('process_audio_file', {
      filePath: selectedFilePath,
      whisperModel: model,
    });
    setResult(response as string);
    setIsProcessing(false);
  };

  const handleSummarize = async () => {
    if (!result) return;

    setIsSummarizing(true);
    setSummary('');
    setProcessStep(null);

    try {
      const response = await invoke('summarize_transcript', {
        transcript: result,
        llmModel: llmModel,
        outputMode: outputMode,
      });
      console.log('RESUMEN', response);
      setSummary(response as string);
    } catch (error) {
      console.error('Error al resumir:', error);
      setSummary('Error al generar el resumen: ' + error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'opus'] }],
      });

      if (selected && typeof selected === 'string') {
        setResult('');
        setSelectedFileFilePath(selected);
        const assetUrl = convertFileSrc(selected);
        const fileName = selected.split(/[\\/]/).pop() || 'Audio';
        setFileInfo({ name: fileName, url: assetUrl });
        setProcessStep(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-full max-w-4xl lg:max-w-full mx-auto px-6 lg:px-10 py-4 flex flex-col gap-2">
      <div className="flex flex-col lg:flex-row justify-center items-center lg:items-start gap-4">
        <div className="w-full max-w-lg flex flex-col gap-4">
          <button
            onClick={handleSelectFile}
            className="group w-full border border-dashed border-muted hover:border-accent rounded-xl py-2 transition-all duration-300"
          >
            <div className="flex flex-col items-center gap-2 text-muted group-hover:text-accent transition-colors">
              <CloudUpload size={28} strokeWidth={1.5} />
              <span className="text-sm font-medium">
                {fileInfo ? 'Seleccionar otro' : 'Seleccionar audio'}
              </span>
            </div>
          </button>
          {fileInfo && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Music size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileInfo.name}</p>
                <audio controls src={fileInfo.url} className="w-full h-8 mt-1" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider">Modelo</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-surface border border-transparent focus:border-accent outline-none text-sm transition-colors"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>

          {selectedFilePath && (
            <button
              onClick={processAudioFile}
              disabled={isProcessing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all duration-300 ${
                isProcessing
                  ? 'bg-accent cursor-not-allowed animate-pulse'
                  : 'bg-accent hover:opacity-90 active:scale-[0.98]'
              }`}
            >
              <WandSparkles size={16} />
              {isProcessing ? 'Procesando...' : 'Transcribir'}
            </button>
          )}
          {processStep && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-muted">
                <span>{processStep.step}</span>
                {processStep.count != null && <span>{processStep.count}%</span>}
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface overflow-auto">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${processStep.count != null ? processStep.count : 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="w-full rounded-lg relative">
          <DisplayTranscript text={result} isProcessing={isProcessing} />
        </div>
        {summary && (
          <div className="w-full rounded-lg">
            <DisplaySummary text={summary} isGenerating={isSummarizing} />
          </div>
        )}
      </div>
      {result && !isProcessing && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider">Modelo de resumen</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-surface border border-transparent focus:border-accent outline-none text-sm transition-colors"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            >
              {llmModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted uppercase tracking-wider">Tipo de salida</label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-surface border border-transparent focus:border-accent outline-none text-sm transition-colors"
              value={outputMode}
              onChange={(e) => setOutputMode(e.target.value as 'summary' | 'acta')}
            >
              <option value="summary">Resumen — Manual de consulta rápida</option>
              <option value="acta">Acta — Minuta de sesión o junta</option>
            </select>
          </div>

          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm text-white transition-all duration-300 ${
              isSummarizing
                ? 'bg-purple-600 cursor-not-allowed animate-pulse'
                : 'bg-purple-600 hover:opacity-90 active:scale-[0.98]'
            }`}
          >
            <Sparkles size={16} />
            {isSummarizing ? 'Generando...' : outputMode === 'acta' ? 'Generar Acta' : 'Resumir'}
          </button>
        </>
      )}
      <div className="w-full flex justify-center items-center gap-2 border-t border-surface pt-2">
        <p className="text-xs font-mono border border-surface text-muted p-1 rounded">
          {model.replace('.bin', '')}
        </p>
        <p className="text-xs font-mono border border-surface  text-muted p-1 rounded">
          {resourcesUsed}
        </p>
      </div>
    </div>
  );
};
